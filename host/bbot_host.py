#!/usr/bin/env python3
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import urllib.error
import urllib.request

bbot_process = None
ANSI_ESCAPE = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
VALID_DEP_OPTIONS = {
    "--ignore-failed-deps",
    "--no-deps",
    "--force-deps",
    "--retry-deps",
    "--install-all-deps",
}
PYPI_JSON_URL = "https://pypi.org/pypi/bbot/json"


def find_bbot_path():
    candidates = (
        os.path.expanduser("~/.local/bin/bbot"),
        shutil.which("bbot"),
    )
    for candidate in candidates:
        if candidate and os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None


def send_message(obj):
    try:
        message = json.dumps(obj).encode("utf-8")
        message_length = struct.pack("I", len(message))
        sys.stdout.buffer.write(message_length)
        sys.stdout.buffer.write(message)
        sys.stdout.buffer.flush()
    except BrokenPipeError:
        sys.exit(1)


def read_message():
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    message_length = struct.unpack("I", raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode("utf-8")
    return json.loads(message)


def clean_output_line(line):
    return ANSI_ESCAPE.sub("", line).rstrip("\r\n")


def clean_output_text(text):
    return "\n".join(clean_output_line(line) for line in (text or "").splitlines() if clean_output_line(line))


def stream_process(process, output_file=None):
    for line in process.stdout:
        line = clean_output_line(line)
        if line:
            if output_file is not None:
                output_file.write(line + "\n")
                output_file.flush()
            send_message({"type": "scanResult", "data": line})
    process.stdout.close()
    process.wait()
    return process.returncode


def run_process_capture(command):
    process = subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    return process.returncode, clean_output_text(process.stdout)


def sanitize_output_name(value):
    sanitized = re.sub(r"[^A-Za-z0-9._-]+", "_", value).strip("._")
    return sanitized or "scan"


def build_scan_command(bbot_path, target, scantype, deadly, eventtype, moddep, flagtype, burp, scope):
    cmd = [bbot_path, "-t", target, "-y", "-p", scantype]

    if flagtype:
        cmd.extend(["-f", flagtype])

    if eventtype and eventtype != "*":
        cmd.extend(["--event-types", eventtype])

    if moddep in VALID_DEP_OPTIONS:
        cmd.append(moddep)

    if burp:
        cmd.extend(["-c", "web.http_proxy=http://127.0.0.1:8080"])

    if scope:
        cmd.append("--strict-scope")

    if deadly == "--allow-deadly":
        cmd.append("--allow-deadly")

    return cmd


def extract_version(value):
    matches = re.findall(r"v?(\d+(?:\.\d+)+)", value or "")
    return matches[-1] if matches else ""


def version_parts(value):
    return tuple(int(part) for part in re.findall(r"\d+", value or ""))


def fetch_latest_bbot_version():
    try:
        with urllib.request.urlopen(PYPI_JSON_URL, timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return str(payload.get("info", {}).get("version", "")).strip()
    except (OSError, urllib.error.URLError, ValueError, json.JSONDecodeError):
        return ""


def get_installed_bbot_version(bbot_path):
    returncode, output = run_process_capture([bbot_path, "--version"])
    if returncode != 0:
        return ""
    return extract_version(output)


def merge_table_row(row_chunks):
    width = max(len(chunk) for chunk in row_chunks)
    merged = [""] * width
    for chunk in row_chunks:
        for index in range(width):
            value = chunk[index].strip() if index < len(chunk) else ""
            if value:
                merged[index] += value
    return merged


def parse_table_rows(output):
    rows = []
    current_row = []
    in_body = False

    for raw_line in output.splitlines():
        line = clean_output_line(raw_line)
        if not line:
            continue
        if line.startswith("+"):
            if "=" in line:
                in_body = True
                current_row = []
                continue
            if in_body and current_row:
                rows.append(merge_table_row(current_row))
                current_row = []
            continue
        if in_body and line.startswith("|"):
            cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
            current_row.append(cells)

    if in_body and current_row:
        rows.append(merge_table_row(current_row))

    return rows


def unique_sorted(values):
    return sorted({value for value in values if value})


def split_csv_tokens(value):
    return [token.strip() for token in (value or "").split(",") if token.strip() and token.strip() != "*"]


def get_bbot_capabilities():
    bbot_path = find_bbot_path()
    capabilities = {
        "presets": [],
        "modules": [],
        "flags": [],
        "eventTypes": [],
    }

    if not bbot_path:
        return capabilities

    presets_returncode, presets_output = run_process_capture([bbot_path, "--list-presets"])
    if presets_returncode == 0:
        capabilities["presets"] = [row[0] for row in parse_table_rows(presets_output) if row and row[0]]

    modules_returncode, modules_output = run_process_capture([bbot_path, "--list-modules"])
    if modules_returncode == 0:
        flags = []
        event_types = []
        modules = []
        for row in parse_table_rows(modules_output):
            if not row:
                continue
            if len(row) > 0 and row[0]:
                modules.append(row[0])
            if len(row) > 4:
                flags.extend(split_csv_tokens(row[4]))
            if len(row) > 5:
                event_types.extend(split_csv_tokens(row[5]))
            if len(row) > 6:
                event_types.extend(split_csv_tokens(row[6]))
        capabilities["modules"] = unique_sorted(modules)
        capabilities["flags"] = unique_sorted(flags)
        capabilities["eventTypes"] = unique_sorted(event_types)

    return capabilities


def get_bbot_status():
    latest_version = fetch_latest_bbot_version()
    bbot_path = find_bbot_path()

    if not bbot_path:
        message = "BBOT is not installed. Press Deploy BBOT to install the latest stable version."
        if latest_version:
            message = f"BBOT is not installed. Press Deploy BBOT to install v{latest_version}."
        return {
            "hostConfigured": True,
            "bbotInstalled": False,
            "bbotPath": "",
            "installedVersion": "",
            "latestVersion": latest_version,
            "updateAvailable": False,
            "status": "missing",
            "message": message,
        }

    installed_version = get_installed_bbot_version(bbot_path)
    update_available = False
    status = "ready"

    if latest_version and installed_version:
        update_available = version_parts(latest_version) > version_parts(installed_version)

    if update_available:
        message = f"BBOT v{installed_version} is installed. v{latest_version} is available."
        status = "outdated"
    elif installed_version and latest_version:
        message = f"BBOT v{installed_version} is installed and up to date."
    elif installed_version:
        message = f"BBOT v{installed_version} is installed."
    else:
        message = "BBOT is installed."

    return {
        "hostConfigured": True,
        "bbotInstalled": True,
        "bbotPath": bbot_path,
        "installedVersion": installed_version,
        "latestVersion": latest_version,
        "updateAvailable": update_available,
        "status": status,
        "message": message,
    }


def emit_current_preset(cmd):
    process = subprocess.Popen(
        cmd + ["--current-preset"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        universal_newlines=True,
    )
    returncode = stream_process(process)
    if returncode != 0:
        raise RuntimeError(f"Failed to load current preset (exit code {returncode})")


def run_scan(target, scantype, deadly, eventtype, moddep, flagtype, burp, viewtype, scope):
    global bbot_process

    target = str(target or "").strip()
    scantype = str(scantype or "").strip()

    if not target:
        send_message({"type": "error", "data": "Target is required"})
        return

    if not scantype:
        send_message({"type": "error", "data": "Preset is required"})
        return

    bbot_path = find_bbot_path()
    if not bbot_path:
        send_message({"type": "error", "data": "BBOT is not installed. Press Deploy BBOT to install it first."})
        return

    cmd = build_scan_command(bbot_path, target, scantype, deadly, eventtype, moddep, flagtype, burp, scope)
    output_path = os.path.abspath(f"{sanitize_output_name(target)}_output.txt")

    try:
        if viewtype:
            emit_current_preset(cmd)
            send_message({"type": "info", "data": "Current preset loaded."})
            return

        with open(output_path, "w", encoding="utf-8") as output_file:
            bbot_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True,
            )

            returncode = stream_process(bbot_process, output_file)

        bbot_process = None
        if returncode == 0:
            send_message({"type": "info", "data": f"Scan completed. Output saved to {output_path}"})
        else:
            send_message({"type": "error", "data": f"Scan failed with exit code {returncode}"})
    except Exception as e:
        bbot_process = None
        send_message({"type": "error", "data": f"Scan failed: {str(e)}"})


def kill_scan():
    global bbot_process
    if bbot_process and bbot_process.poll() is None:
        bbot_process.terminate()
        bbot_process.wait()
        bbot_process = None
        return {"type": "info", "data": "Scan terminated."}
    return {"type": "info", "data": "No scan running to terminate."}


def is_allowed_read_path(file_path):
    file_path = os.path.abspath(os.path.expanduser(file_path))
    allowed_roots = (
        os.path.join(os.path.expanduser("~"), ".bbot", "scans"),
        os.path.join(default_deploy_dir(), "host"),
    )

    for root in allowed_roots:
        root = os.path.abspath(root)
        try:
            if os.path.commonpath([file_path, root]) == root:
                return True
        except ValueError:
            continue

    return False


def read_file(file_path):
    file_path = os.path.abspath(os.path.expanduser(str(file_path or "").strip()))
    if not os.path.exists(file_path):
        return {"error": "File not found"}
    if not is_allowed_read_path(file_path):
        return {"error": "Access denied"}
    try:
        with open(file_path, "r", encoding="utf-8") as file_handle:
            data = file_handle.read()
        return {"data": data}
    except Exception as e:
        return {"error": f"Failed to read file: {str(e)}"}


def read_subdomains(subdomains_file):
    return read_file(subdomains_file)


def default_deploy_dir():
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def run_deploy(deploy_dir):
    deploy_dir = str(deploy_dir or "").strip()
    deploy_root = os.path.abspath(os.path.expanduser(deploy_dir)) if deploy_dir else default_deploy_dir()
    deploy_script = os.path.join(deploy_root, "deploy.sh")

    if not os.path.isfile(deploy_script):
        return {"type": "error", "data": f"deploy.sh not found in {deploy_root}"}

    try:
        process = subprocess.Popen(
            ["bash", deploy_script],
            cwd=deploy_root,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True,
        )
        returncode = stream_process(process)
        if returncode != 0:
            return {"type": "error", "data": f"Deployment failed with exit code {returncode}"}
        return {"type": "deployComplete", "data": get_bbot_status()}
    except Exception as e:
        return {"type": "error", "data": f"Deployment failed: {str(e)}"}


def main():
    while True:
        msg = read_message()
        if msg is None:
            break

        command = msg.get("command")
        if command == "scan":
            run_scan(
                msg.get("target", ""),
                msg.get("scantype", ""),
                msg.get("deadly", ""),
                msg.get("eventtype", ""),
                msg.get("moddep", ""),
                msg.get("flagtype", ""),
                msg.get("burp", ""),
                msg.get("viewtype", ""),
                msg.get("scope", ""),
            )
        elif command == "deploy":
            send_message(run_deploy(msg.get("deployDir", "")))
        elif command == "getStatus":
            send_message({"type": "status", "data": get_bbot_status()})
        elif command == "getCapabilities":
            send_message({"type": "capabilities", "data": get_bbot_capabilities()})
        elif command == "readFile":
            send_message(read_file(msg.get("path", "")))
        elif command == "killScan":
            send_message(kill_scan())
        elif command == "getSubdomains":
            send_message(read_file(msg.get("subdomains", "")))
        else:
            send_message({"type": "error", "data": f"Unknown command: {command}"})


if __name__ == "__main__":
    main()
