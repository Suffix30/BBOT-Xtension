import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "bbot_host", Path(__file__).resolve().parents[1] / "host" / "bbot_host.py"
)
bbot_host = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bbot_host)


def test_read_subdomains_file_not_found(tmp_path):
    missing_file = tmp_path / "missing.txt"
    result = bbot_host.read_subdomains(str(missing_file))
    assert result == {"error": "File not found"}


def test_read_subdomains_with_temp_file(tmp_path):
    sub_file = tmp_path / "subs.txt"
    contents = "sub.example.com\n"
    sub_file.write_text(contents, encoding="utf-8")
    result = bbot_host.read_subdomains(str(sub_file))
    assert result == {"data": contents}


def test_kill_scan_when_not_running():
    bbot_host.bbot_process = None
    result = bbot_host.kill_scan()
    assert result == {"type": "info", "data": "No scan running to terminate."}
