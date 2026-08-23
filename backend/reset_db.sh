#!/bin/bash

# This script resets the database and starts fresh
# Exit on any error
set -e

echo "============================================="
echo "   MEDIMEI DATABASE RESET & FRESH SETUP      "
echo "============================================="

# 1. Force kill existing instances
echo "[1/6] Force killing lingering database processes..."
kill -9 $(pgrep mysql) 2>/dev/null || true
kill -9 $(pgrep mysqld) 2>/dev/null || true

# 2. Purge old package files and corrupt data folders
echo "[2/6] Purging old packages and removing data directories..."
apt-get purge -y mariadb-server mariadb-client mysql-common
apt-get autoremove -y
apt-get clean
rm -rf /var/lib/mysql
rm -rf /etc/mysql

# 3. Install packages fresh
echo "[3/6] Installing fresh MariaDB packages..."
apt-get update
apt-get install -y mariadb-server mariadb-client

# 4. Start MariaDB daemon in the background
echo "[4/6] Starting MariaDB service..."
mysqld_safe --user=mysql &

# 5. Wait for the socket to initialize
echo "[5/6] Waiting 10 seconds for database initialization..."
sleep 10

# 6. Configure root password and create the MediMei database
echo "[6/6] Setting root password to 'medimei123' and creating database..."
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'medimei123'; FLUSH PRIVILEGES;"
mysql -u root -pmedimei123 -e "CREATE DATABASE IF NOT EXISTS MediMei;"

# 7. Run alembic migrations
echo "Running alembic migrations..."
cd /workspace/drug-chatbot/backend
PYTHONPATH=. alembic upgrade head

echo "============================================="
echo "   DATABASE RESET COMPLETED SUCCESSFULLY!    "
echo "============================================="
