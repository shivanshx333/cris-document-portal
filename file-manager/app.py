import os
from flask import Flask, request, redirect, url_for, render_template, send_from_directory, flash, abort
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = "cris-document-portal-key"

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER


def resolve_filepath(filename):
    """Resolve a filename to a path inside the upload folder, blocking path traversal."""
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    real = os.path.realpath(filepath)
    if not real.startswith(os.path.realpath(app.config["UPLOAD_FOLDER"])):
        return None
    return real


def get_file_size(filepath):
    size = os.path.getsize(filepath)
    if size < 1024:
        return f"{size} B"
    elif size < 1024 * 1024:
        return f"{size / 1024:.1f} KB"
    else:
        return f"{size / (1024 * 1024):.1f} MB"


@app.route("/")
def index():
    folder = app.config["UPLOAD_FOLDER"]
    filenames = sorted(os.listdir(folder))
    files = []
    for name in filenames:
        filepath = os.path.join(folder, name)
        if os.path.isfile(filepath):
            files.append({
                "name": name,
                "size": get_file_size(filepath),
            })
    return render_template("index.html", files=files)


@app.route("/upload", methods=["POST"])
def upload():
    file = request.files.get("file")
    if not file or not file.filename:
        flash("No file selected.", "error")
        return redirect(url_for("index"))

    filename = secure_filename(file.filename)
    if not filename:
        flash("Invalid file name.", "error")
        return redirect(url_for("index"))

    file.save(os.path.join(app.config["UPLOAD_FOLDER"], filename))
    flash(f'"{filename}" uploaded successfully.', "success")
    return redirect(url_for("index"))


@app.route("/download/<path:filename>")
def download(filename):
    filepath = resolve_filepath(filename)
    if not filepath or not os.path.isfile(filepath):
        flash("File not found.", "error")
        return redirect(url_for("index"))
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename, as_attachment=True)


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
