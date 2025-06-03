#!/usr/bin/env python3
import sys
import json
import subprocess
import struct
import os
import re

bbot_process = None

def get_bbot_path():
    """Get path to BBOT executable."""
    bbot_path = os.path.expanduser("~/.local/bin/bbot")
    if os.path.exists(bbot_path):
        print(f"Found BBOT at: {bbot_path}")
        return bbot_path

    try:
        bbot_path = subprocess.check_output(['which', 'bbot'], text=True).strip()
        if bbot_path:
            print(f"Found BBOT at: {bbot_path}")
            return bbot_path
    except:
        pass

    send_message({"type": "error", "data": "BBOT executable not found in PATH or ~/.local/bin/bbot"})
    sys.exit(1)

def send_message(obj):
    """Send JSON message to Firefox (native messaging)."""
    try:
        message = json.dumps(obj).encode("utf-8")
        message_length = struct.pack("I", len(message))
        sys.stdout.buffer.write(message_length)
        sys.stdout.buffer.write(message)
        sys.stdout.buffer.flush()
    except BrokenPipeError:
        sys.exit(1)

def read_message():
    """Read JSON message from Firefox."""
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None

    message_length = struct.unpack("I", raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode("utf-8")
    return json.loads(message)

def run_scan(target, scantype, deadly, eventtype, moddep, flagtype, burp, viewtype, scope):
    """Run BBOT and stream output in real-time to Firefox."""
    global bbot_process
    bbot_path = get_bbot_path()
    print(f"Running BBOT from: {bbot_path}")
    
    cmd = [bbot_path, "-t", target, "-y", "-p", scantype, "--event-types", eventtype, moddep]

    if flagtype:
        cmd.extend(["-f", flagtype])

    if burp:
        cmd.extend(["-c", "web.http_proxy=http://127.0.0.1:8080"])

    if viewtype:
        cmd.append("--current-preset")
    if scope:
        cmd.append("--strict-scope")
    if deadly == "--allow-deadly":
        cmd.append("--allow-deadly")
        cmd.insert(0, "pkexec")

    output_path = f"{target}_output.txt"
    try:
        with open(output_path, "w", encoding="utf-8") as output_file:
            bbot_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
        
            for line in bbot_process.stdout:
                ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
                line = ansi_escape.sub('', line)
                line = line.strip()
                if line:
                    output_file.write(line + "\n")  
                    output_file.flush() 
                    send_message({"type": "scanResult", "data": line}) 

            bbot_process.stdout.close()
            bbot_process.wait()

        bbot_process = None
        send_message({"type": "info", "data": f"Scan completed. Output saved to {output_path}"})
    except Exception as e:
        send_message({"type": "error", "data": f"Scan failed: {str(e)}"})

def kill_scan():
    """Kill the running BBOT process."""
    global bbot_process
    if bbot_process and bbot_process.poll() is None: 
        bbot_process.terminate()
        bbot_process.wait()
        bbot_process = None
        return {"type": "info", "data": "Scan terminated."}
    return {"type": "info", "data": "No scan running to terminate."}

def read_subdomains(subdomains_file):
    """Reads the subdomains file and returns its contents."""
    if not os.path.exists(subdomains_file):
        return {"error": "File not found"}
    
    try:
        with open(subdomains_file, "r", encoding="utf-8") as f:
            data = f.read()
        return {"data": data}
    except Exception as e:
        return {"error": f"Failed to read subdomains: {str(e)}"}

def main():
    while True:
        msg = read_message()
        if msg is None:
            break

        command = msg.get("command")
        if command == "shell": 
            try:
                script = msg.get("script", "")
                process = subprocess.Popen(
                    script,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True
                )
                
                for line in process.stdout:
                    line = line.strip()
                    if line:
                        send_message({"type": "scanResult", "data": line})
                
                process.stdout.close()
                process.wait()

                if process.returncode != 0:
                    send_message({"type": "error", "data": f"Command failed with exit code {process.returncode}"})
            except Exception as e:
                send_message({"type": "error", "data": str(e)})
        elif command == "scan": 
            run_scan(
                msg.get("target", ""),
                msg.get("scantype", ""),
                msg.get("deadly", ""),
                msg.get("eventtype", ""),
                msg.get("moddep", ""),
                msg.get("flagtype", ""),
                msg.get("burp", ""),
                msg.get("viewtype", ""),
                msg.get("scope", "")
            )
        elif command == "killScan": 
            send_message(kill_scan())
        elif command == "getSubdomains":
            send_message(read_subdomains(msg.get("subdomains", "")))
        else:
            send_message({"type": "error", "data": f"Unknown command: {command}"})

if __name__ == "__main__":
    main()
