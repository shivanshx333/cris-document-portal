import os
import random
import string
from datetime import datetime, timedelta
from functools import wraps
from collections import Counter
from flask import (
    Flask, request, redirect, url_for, render_template,
    send_from_directory, flash, session
)
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge

app = Flask(__name__)
# In production, set SECRET_KEY environment variable on the host (e.g. Render dashboard).
app.secret_key = os.environ.get("SECRET_KEY", "cris-document-portal-dev-secret")
app.permanent_session_lifetime = timedelta(hours=8)

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

MAX_FILE_SIZE_MB = 16
ALLOWED_EXTENSIONS = {
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "txt", "csv", "rtf", "odt",
    "png", "jpg", "jpeg", "gif", "bmp", "webp", "svg",
    "zip", "rar", "7z",
}

# ─────────────────────────────────────────────────────────────
# Mock user directory (no real database — fine for intern demo)
# ─────────────────────────────────────────────────────────────
USERS = {
    "admin": {
        "password": "cris123",
        "name": "Shivansh Sharma",
        "role": "Admin",
        "designation": "Software Intern · Delhi Division",
        "employee_id": "CRIS/INT/2026/045",
    },
    "viewer": {
        "password": "viewer123",
        "name": "Anita Verma",
        "role": "Viewer",
        "designation": "Section Officer · Records",
        "employee_id": "CRIS/SO/2024/119",
    },
}

# In-memory activity log (lives until restart — good enough for demo)
activity_log = []

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE_MB * 1024 * 1024


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if "user" not in session:
            return redirect(url_for("login"))
        return view(*args, **kwargs)
    return wrapped


def initials_from_name(name):
    parts = name.split()
    if not parts:
        return "U"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def generate_captcha():
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choice(chars) for _ in range(5))


def log_activity(action, target=""):
    now = datetime.now()
    activity_log.append({
        "ts": now,
        "time": now.strftime("%d %b %Y, %H:%M:%S"),
        "user": session.get("name", "System"),
        "role": session.get("role", "—"),
        "action": action,
        "target": target,
    })
    # cap at 200 entries
    if len(activity_log) > 200:
        del activity_log[: len(activity_log) - 200]


def resolve_filepath(filename):
    """Resolve a filename inside the upload folder, blocking path traversal."""
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


def list_files():
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
    files.sort(key=lambda f: f["modified_ts"], reverse=True)
    return files


# ─────────────────────────────────────────────────────────────
# Context processor (makes current_user etc. available in all templates)
# ─────────────────────────────────────────────────────────────

@app.context_processor
def inject_session_info():
    if "user" not in session:
        return {}
    return {
        "current_user": session.get("user"),
        "current_name": session.get("name"),
        "current_role": session.get("role"),
        "current_designation": session.get("designation"),
        "current_employee_id": session.get("employee_id"),
        "current_initials": session.get("initials"),
        "last_login": session.get("login_time"),
    }


# ─────────────────────────────────────────────────────────────
# Auth routes
# ─────────────────────────────────────────────────────────────

@app.route("/login", methods=["GET", "POST"])
def login():
    if "user" in session:
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        username = request.form.get("username", "").strip().lower()
        password = request.form.get("password", "")
        captcha_input = request.form.get("captcha", "").strip().upper()
        captcha_expected = session.get("captcha", "")

        if not captcha_expected or captcha_input != captcha_expected:
            flash("Captcha verification failed. Please try again.", "error")
            session["captcha"] = generate_captcha()
            return render_template("login.html", captcha=session["captcha"])

        user = USERS.get(username)
        if not user or user["password"] != password:
            flash("Invalid User ID or password.", "error")
            session["captcha"] = generate_captcha()
            return render_template("login.html", captcha=session["captcha"])

        # Successful login
        session.clear()
        session.permanent = True
        session["user"] = username
        session["name"] = user["name"]
        session["role"] = user["role"]
        session["designation"] = user["designation"]
        session["employee_id"] = user["employee_id"]
        session["initials"] = initials_from_name(user["name"])
        session["login_time"] = datetime.now().strftime("%d %b %Y, %H:%M IST")

        log_activity("Signed in")
        flash(f"Welcome, {user['name']}.", "success")
        return redirect(url_for("dashboard"))

    # GET — refresh captcha
    session["captcha"] = generate_captcha()
    return render_template("login.html", captcha=session["captcha"])


@app.route("/logout")
def logout():
    if "user" in session:
        log_activity("Signed out")
    session.clear()
    flash("You have been signed out.", "success")
    return redirect(url_for("login"))


# ─────────────────────────────────────────────────────────────
# Main pages
# ─────────────────────────────────────────────────────────────

@app.route("/")
@login_required
def dashboard():
    files = list_files()
    total_bytes = sum(f["size_bytes"] for f in files)

    # File type distribution
    type_counter = Counter(f["category_label"] for f in files)
    type_labels = list(type_counter.keys())
    type_values = list(type_counter.values())

    # Uploads over the last 7 days
    today = datetime.now().date()
    day_buckets = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        day_buckets.append({"date": d, "label": d.strftime("%d %b"), "count": 0})
    for f in files:
        d = datetime.fromtimestamp(f["modified_ts"]).date()
        for bucket in day_buckets:
            if bucket["date"] == d:
                bucket["count"] += 1
                break

    today_count = sum(1 for f in files
                      if datetime.fromtimestamp(f["modified_ts"]).date() == today)

    return render_template(
        "dashboard.html",
        total_files=len(files),
        total_size=format_size(total_bytes) if total_bytes else "0 B",
        today_count=today_count,
        type_chart={"labels": type_labels, "values": type_values},
        upload_chart={
            "labels": [b["label"] for b in day_buckets],
            "values": [b["count"] for b in day_buckets],
        },
        recent_files=files[:5],
        recent_activity=list(reversed(activity_log[-6:])),
    )


@app.route("/documents")
@login_required
def documents():
    files = list_files()
    total_bytes = sum(f["size_bytes"] for f in files)
    return render_template(
        "documents.html",
        files=files,
        total_size=format_size(total_bytes) if total_bytes else "0 B",
        max_file_size_mb=MAX_FILE_SIZE_MB,
    )


@app.route("/activity")
@login_required
def activity():
    return render_template(
        "activity.html",
        entries=list(reversed(activity_log)),
    )


# ─────────────────────────────────────────────────────────────
# File operations (login required)
# ─────────────────────────────────────────────────────────────

@app.route("/upload", methods=["POST"])
@login_required
def upload():
    uploaded = request.files.getlist("files")
    if not uploaded or all(not f.filename for f in uploaded):
        flash("No file selected.", "error")
        return redirect(url_for("documents"))

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
        log_activity("Uploaded", unique)
        success += 1

    if success == 1:
        flash("1 file uploaded successfully.", "success")
    elif success > 1:
        flash(f"{success} files uploaded successfully.", "success")
    for msg in errors:
        flash(msg, "error")
    return redirect(url_for("documents"))


@app.errorhandler(RequestEntityTooLarge)
def handle_too_large(e):
    flash(f"File too large. Maximum size is {MAX_FILE_SIZE_MB} MB per file.", "error")
    return redirect(url_for("documents"))


@app.route("/download/<path:filename>")
@login_required
def download(filename):
    filepath = resolve_filepath(filename)
    if not filepath or not os.path.isfile(filepath):
        flash("File not found.", "error")
        return redirect(url_for("documents"))
    log_activity("Downloaded", filename)
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename, as_attachment=True)


@app.route("/preview/<path:filename>")
@login_required
def preview(filename):
    filepath = resolve_filepath(filename)
    if not filepath or not os.path.isfile(filepath):
        return "File not found", 404
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename, as_attachment=False)


@app.route("/delete/<path:filename>", methods=["POST"])
@login_required
def delete(filename):
    filepath = resolve_filepath(filename)
    if not filepath or not os.path.isfile(filepath):
        flash("File not found.", "error")
        return redirect(url_for("documents"))
    os.remove(filepath)
    log_activity("Deleted", filename)
    flash(f'"{filename}" deleted successfully.', "success")
    return redirect(url_for("documents"))


if __name__ == "__main__":
    print(f"Files are stored in: {UPLOAD_FOLDER}")
    print("Open http://127.0.0.1:5001 in your browser")
    app.run(host="0.0.0.0", port=5001, debug=True)
