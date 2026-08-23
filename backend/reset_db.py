import subprocess
import time
import sys
import os

def run_cmd(command, check=True):
    """Utility function to execute shell commands and print output."""
    print(f"\n[Executing]: {command}")
    try:
        result = subprocess.run(command, shell=True, check=check, text=True)
        return result
    except subprocess.CalledProcessError as e:
        print(f"Error executing command: {e}")
        if check:
            sys.exit(1)

def reset_database():
    print("==================================================")
    # [ignoring loop detection]
    print("   MEDIMEI DATABASE RESET & FRESH SETUP (PYTHON)  ")
    print("==================================================")

    # 1. Force kill existing instances
    print("\n[1/6] Force killing lingering database processes...")
    run_cmd("kill -9 $(pgrep mysql) 2>/dev/null || true", check=False)
    run_cmd("kill -9 $(pgrep mysqld) 2>/dev/null || true", check=False)
    run_cmd("kill -9 $(pgrep mariadbd) 2>/dev/null || true", check=False)

    # 2. Purge old package files and corrupt data folders
    print("\n[2/6] Purging old packages and removing data directories...")
    run_cmd("apt-get purge -y mariadb-server mariadb-client mysql-common", check=False)
    run_cmd("apt-get autoremove -y", check=False)
    run_cmd("apt-get clean", check=False)
    run_cmd("rm -rf /var/lib/mysql", check=False)
    run_cmd("rm -rf /etc/mysql", check=False)

    # 3. Install packages fresh
    print("\n[3/6] Installing fresh MariaDB packages...")
    run_cmd("apt-get update")
    run_cmd("apt-get install -y mariadb-server mariadb-client")

    # 4. Start MariaDB daemon in the background
    print("\n[4/6] Starting MariaDB service...")
    subprocess.Popen("mysqld_safe --user=mysql &", shell=True)

    # 5. Wait for the socket to initialize
    print("\n[5/6] Waiting 10 seconds for database initialization...")
    time.sleep(10)

    # 6. Configure root password and create the MediMei database
    print("\n[6/6] Setting root password to 'medimei123' and creating database...")
    run_cmd("mysql -e \"ALTER USER 'root'@'localhost' IDENTIFIED BY 'medimei123'; FLUSH PRIVILEGES;\"")
    run_cmd("mysql -u root -pmedimei123 -e \"CREATE DATABASE IF NOT EXISTS MediMei;\"")

    # 7. Run alembic migrations
    print("\n[7/7] Running database migrations...")
    backend_path = "/workspace/drug-chatbot/backend"
    if os.path.exists(backend_path):
        os.chdir(backend_path)
    os.environ["PYTHONPATH"] = "."
    run_cmd("alembic upgrade head")

    print("\n==================================================")
    print("   DATABASE RESET COMPLETED SUCCESSFULLY!         ")
    print("==================================================")

if __name__ == "__main__":
    # Check if running as root
    if os.geteuid() != 0:
        print("Error: This script must be run as root (sudo).")
        sys.exit(1)
    reset_database()
