import subprocess, os
BASE_DIR = os.path.dirname(__file__)
KUBECONFIG_DIR = os.path.join(BASE_DIR, "kubeconfigs")
os.makedirs(KUBECONFIG_DIR, exist_ok=True)

def run_command(cmd_list, capture_output=True):
    try:
        proc = subprocess.run(cmd_list, capture_output=capture_output, text=True, check=False)
        return proc.returncode, proc.stdout, proc.stderr
    except Exception as e:
        return 1, "", str(e)

def create_k3d_cluster(cluster_name, servers=1, agents=1):
    cmd = ["k3d", "cluster", "create", cluster_name, "--servers", str(servers), "--agents", str(agents), "--wait"]
    rc, out, err = run_command(cmd)
    if rc != 0:
        return False, out+err
    rc2, kube_out, err2 = run_command(["k3d", "kubeconfig", "get", cluster_name])
    kube_path = os.path.join(KUBECONFIG_DIR, f"kubeconfig-{cluster_name}")
    if rc2 == 0:
        with open(kube_path, "w") as f:
            f.write(kube_out)
    return True, kube_path

def delete_k3d_cluster(cluster_name):
    rc, out, err = run_command(["k3d", "cluster", "delete", cluster_name])
    return rc == 0, out+err

def run_smoke_test(kubeconfig_path):
    script = os.path.join(os.path.dirname(BASE_DIR), "scripts", "run_demo_test.sh")
    rc, out, err = run_command(["bash", script, kubeconfig_path])
    return rc, out, err
