import http.server
import base64
import json
import os
import socketserver
import sys
import threading

import webview


def resource_path(relative):
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, relative)


DIST_DIR = resource_path("dist")


def data_dir():
    base = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else os.path.dirname(os.path.abspath(__file__))
    config = os.path.join(base, "配置.json")
    try:
        if os.path.exists(config):
            with open(config, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            override = cfg.get("dataDir")
            if override and isinstance(override, str) and override.strip():
                return override.strip()
    except Exception:
        pass
    return os.path.join(base, "数据")


def data_file():
    return os.path.join(data_dir(), "营收日报数据.json")


class Api:
    def get_role(self):
        try:
            for name in ("role-staff", "role-manager"):
                path = resource_path(name)
                if os.path.exists(path):
                    with open(path, "r", encoding="utf-8") as f:
                        return f.read().strip() or "staff"
            return "staff"
        except Exception:
            return "staff"

    def get_data_dir(self):
        try:
            return data_dir()
        except Exception as exc:
            return f"error:{exc}"

    def save_data(self, payload):
        try:
            folder = data_dir()
            os.makedirs(folder, exist_ok=True)
            target = data_file()
            tmp = target + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                f.write(payload)
            os.replace(tmp, target)
            return "saved"
        except Exception as exc:
            return f"error:{exc}"

    def load_data(self):
        try:
            target = data_file()
            if not os.path.exists(target):
                return ""
            with open(target, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as exc:
            return f"error:{exc}"

    def select_folder(self):
        try:
            window = webview.windows[0]
            result = window.create_file_dialog(webview.FOLDER_DIALOG)
            if not result:
                return ""
            return result if isinstance(result, str) else result[0]
        except Exception as exc:
            return f"error:{exc}"

    def list_exports(self, folder):
        try:
            if not folder or not os.path.isdir(folder):
                return []
            extensions = (".xlsx", ".xls", ".csv")
            files = []
            for name in sorted(os.listdir(folder)):
                if name.lower().endswith(extensions):
                    files.append(os.path.join(folder, name))
            return files
        except Exception as exc:
            return [f"error:{exc}"]

    def read_export(self, path):
        try:
            with open(path, "rb") as f:
                return base64.b64encode(f.read()).decode("ascii")
        except Exception as exc:
            return f"error:{exc}"

    def save_pdf(self, data_url, default_name):
        try:
            if not data_url or "," not in data_url:
                return "error:empty"
            payload = base64.b64decode(data_url.split(",", 1)[1])
            window = webview.windows[0]
            result = window.create_file_dialog(
                webview.SAVE_DIALOG,
                save_filename=default_name,
                file_types=("PDF 文件 (*.pdf)",),
            )
            if not result:
                return "cancelled"
            path = result if isinstance(result, str) else result[0]
            with open(path, "wb") as f:
                f.write(payload)
            return "saved"
        except Exception as exc:
            return f"error:{exc}"

    def save_image(self, data_url, default_name):
        try:
            if not data_url or "," not in data_url:
                return "error:empty"
            payload = base64.b64decode(data_url.split(",", 1)[1])
            window = webview.windows[0]
            result = window.create_file_dialog(
                webview.SAVE_DIALOG,
                save_filename=default_name,
                file_types=("PNG 图片 (*.png)",),
            )
            if not result:
                return "cancelled"
            path = result if isinstance(result, str) else result[0]
            with open(path, "wb") as f:
                f.write(payload)
            return "saved"
        except Exception as exc:
            return f"error:{exc}"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)

    def log_message(self, fmt, *args):
        pass


def main():
    api = Api()
    with socketserver.TCPServer(("127.0.0.1", 0), Handler) as httpd:
        port = httpd.server_address[1]
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        webview.create_window(
            "UU 经营报告",
            f"http://127.0.0.1:{port}",
            width=1180,
            height=820,
            min_size=(960, 680),
            js_api=api,
        )
        webview.start()
        httpd.shutdown()


if __name__ == "__main__":
    main()
