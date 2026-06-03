import os
from datetime import datetime
from flask import Flask, request, redirect, url_for, render_template, send_from_directory, flash
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge

app = Flask(__name__)
app.secret_key = "cris-document-portal-key"

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

MAX_FILE_SIZE_MB = 16
ALLOWED_EXTENSIONS = {
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "txt", "csv", "rtf", "odt",
    "png", "jpg", "jpeg", "gif", "bmp", "webp", "svg",
    "zip", "rar", "7z",
}

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE_MB * 1024 * 1024


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def resolve_filepath(filename):
    """Resolve a filename to a path inside the upload folder, blocking path traversal."""
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    real = os.path.realpath(filepath)
    if not real.startswith(os.path.realpath(app.config["UPLOAD_FOLDER"])):
        return None
    return real


def format_size(size_bytes):
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"


def get_extension(filename):
    if "." in filename:
        return filename.rsplit(".", 1)[1].lower()
    return ""


def is_allowed(filename):
    return get_extension(filename) in ALLOWED_EXTENSIONS


def get_file_category(extension):
    """Return (badge_label, css_class) for the file type."""
    ext = extension.lower()
    if ext == "pdf":
        return ("PDF", "icon-pdf")
    if ext in {"doc", "docx", "odt", "rtf"}:
        return ("DOC", "icon-doc")
    if ext in {"xls", "xlsx", "csv"}:
        return ("XLS", "icon-xls")
    if ext in {"ppt", "pptx"}:
        return ("PPT", "icon-ppt")
    if ext in {"png", "jpg", "jpeg", "gif", "bmp", "webp", "svg"}:
        return ("IMG", "icon-img")
    if ext in {"zip", "rar", "7z"}:
        return ("ZIP", "icon-zip")
    if ext == "txt":
        return ("TXT", "icon-txt")
    return (ext.upper() or "FILE", "icon-generic")


def get_unique_filename(folder, filename):
    """If a file with the same name exists, append (1), (2), etc."""
    name, ext = os.path.splitext(filename)
    candidate = filename
    counter = 1
    while os.path.exists(os.path.join(folder, candidate)):
        candidate = f"{name}_{counter}{ext}"
        counter += 1
    return candidate


def is_previewable(extension):
    return extension.lower() in {
        "pdf", "png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "txt"
    }


# ─────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────

@app.route("/")
def index():
    folder = app.config["UPLOAD_FOLDER"]
    files = []
    for name in os.listdir(folder):
        filepath = os.path.join(folder, name)
        if not os.path.isfile(filepath):
            continue
        ext = get_extension(name)
        label, icon_class = get_file_category(ext)
        stat = os.stat(filepath)
        mtime = datetime.fromtimestamp(stat.st_mtime)
        files.append({
            "name": name,
            "size": format_size(stat.st_size),
            "size_bytes": stat.st_size,
            "modified": mtime.strftime("%d %b %Y, %H:%M"),
            "modified_ts": int(stat.st_mtime),
            "extension": ext,
            "category_label": label,
            "icon_class": icon_class,
            "previewable": is_previewable(ext),
        })

    # newest first
    files.sort(key=lambda f: f["modified_ts"], reverse=True)

    total_bytes = sum(f["size_bytes"] for f in files)
    return render_template(
        "index.html",
        files=files,
        total_size=format_size(total_bytes) if total_bytes else "0 B",
        max_file_size_mb=MAX_FILE_SIZE_MB,
    )


@app.route("/upload", methods=["POST"])
def upload():
    uploaded = request.files.getlist("files")
    if not uploaded or all(not f.filename for f in uploaded):
        flash("No file selected.", "error")
        return redirect(url_for("index"))

    success = 0
    errors = []
    for file in uploaded:
        if not file or not file.filename:
            continue
        original = file.filename
        if not is_allowed(original):
            errors.append(f'"{original}" — file type not allowed.')
            continue
        safe = secure_filename(original)
        if not safe:
            errors.append(f'"{original}" — invalid file name.')
            continue
        unique = get_unique_filename(app.config["UPLOAD_FOLDER"], safe)
        file.save(os.path.join(app.config["UPLOAD_FOLDER"], unique))
        success += 1

    if success == 1:
        flash("1 file uploaded successfully.", "success")
    elif success > 1:
        flash(f"{success} files uploaded successfully.", "success")
    for msg in errors:
        flash(msg, "error")
    return redirect(url_for("index"))


@app.errorhandler(RequestEntityTooLarge)
def handle_too_large(e):
    flash(f"File too large. Maximum size is {MAX_FILE_SIZE_MB} MB per file.", "error")
    return redirect(url_for("index"))


@app.route("/download/<path:filename>")
def download(filename):
    filepath = resolve_filepath(filename)
    if not filepath or not os.path.isfile(filepath):
        flash("File not found.", "error")
        return redirect(url_for("index"))
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename, as_attachment=True)


@app.route("/preview/<path:filename>")
def preview(filename):
    """Serve a file inline (for browser preview) instead of as attachment."""
    filepath = resolve_filepath(filename)
    if not filepath or not os.path.isfile(filepath):
        return "File not found", 404
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename, as_attachment=False)


@app.route("/delete/<path:filename>", methods=["POST"])
def delete(filename):
    filepath = resolve_filepath(filename)
    if not filepath or not os.path.isfile(filepath):
        flash("File not found.", "error")
        return redirect(url_for("index"))
    os.remove(filepath)
    flash(f'"{filename}" deleted successfully.', "success")
    return redirect(url_for("index"))


if __name__ == "__main__":
    print(f"Files are stored in: {UPLOAD_FOLDER}")
    print("Open http://127.0.0.1:5001 in your browser")
    app.run(host="0.0.0.0", port=5001, debug=True)
