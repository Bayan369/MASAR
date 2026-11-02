"""Offline smoke check for already-built local images; never deploys or pulls."""

import os
import subprocess
import time
import uuid

ENV = {
    k: v
    for k, v in os.environ.items()
    if k
    not in {
        "DOCKER_HOST",
        "DOCKER_CONTEXT",
        "DOCKER_TLS",
        "DOCKER_TLS_VERIFY",
        "DOCKER_CERT_PATH",
    }
}
DOCKER = ["docker", "--host=unix:///var/run/docker.sock"]


def docker(*args, check=True):
    return subprocess.run(
        [*DOCKER, *args], env=ENV, text=True, capture_output=True, check=check
    )


def main():
    names = []
    try:
        for image, port in [("masar-api:local", 8000), ("masar-web:local", 8080)]:
            docker("image", "inspect", image)
            name = "masar-smoke-" + uuid.uuid4().hex[:10]
            names.append(name)
            docker(
                "run",
                "-d",
                "--pull=never",
                "--name",
                name,
                "--network",
                "none",
                "--read-only",
                "--tmpfs",
                "/tmp",
                "--tmpfs",
                "/var/cache/nginx",
                "--tmpfs",
                "/var/run",
                "--cap-drop",
                "ALL",
                "--security-opt",
                "no-new-privileges:true",
                image,
            )
            command = (
                [
                    "python",
                    "-c",
                    "import http.client,json; c=http.client.HTTPConnection('127.0.0.1',8000,timeout=3);c.request('GET','/api/v1/health');r=c.getresponse();assert r.status==200;assert json.loads(r.read())['status']=='ok'",
                ]
                if port == 8000
                else [
                    "wget",
                    "-Y",
                    "off",
                    "-q",
                    "-O",
                    "/dev/null",
                    "http://127.0.0.1:8080/healthz",
                ]
            )
            for _ in range(40):
                if docker("exec", name, *command, check=False).returncode == 0:
                    break
                time.sleep(0.2)
            else:
                raise RuntimeError("Container health failed: " + image)
            if port == 8000:
                docker(
                    "exec",
                    name,
                    "python",
                    "-c",
                    "import os;assert os.getuid()!=0;assert not os.path.exists('/app/.env')",
                )
                docker(
                    "exec",
                    name,
                    "python",
                    "-c",
                    "import http.client;c=http.client.HTTPConnection('127.0.0.1',8000);c.request('GET','/api/v1/documents');assert c.getresponse().status==401",
                )
            else:
                docker(
                    "exec",
                    name,
                    "sh",
                    "-c",
                    "test $(id -u) -ne 0 && wget -Y off -q -O /tmp/route http://127.0.0.1:8080/assistant && cmp /tmp/route /usr/share/nginx/html/index.html",
                )
            print(
                "PASS non-root/read-only/network-none health and route checks:",
                image,
                flush=True,
            )
        worker = "masar-worker-smoke-" + uuid.uuid4().hex[:10]
        names.append(worker)
        docker(
            "run",
            "-d",
            "--pull=never",
            "--name",
            worker,
            "--network",
            "none",
            "masar-api:local",
            "python",
            "-m",
            "app.worker",
        )
        result = docker("wait", worker)
        assert result.stdout.strip() == "1"
        print(
            "PASS worker fails closed without external configuration; no hosted request.",
            flush=True,
        )
    finally:
        for name in names:
            docker("rm", "-f", "-v", name, check=False)
        print("Local smoke containers removed.", flush=True)


if __name__ == "__main__":
    main()
