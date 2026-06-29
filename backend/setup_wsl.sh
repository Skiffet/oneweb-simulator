#!/bin/bash
set -e

echo "Updating package list..."
sudo apt update

echo "Installing Python 3 and venv..."
sudo apt install -y python3 python3-pip python3-venv curl

echo "Installing Node.js (Version 20)..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo "Setting up Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Installing Node.js dependencies..."
npm install

echo "==================================="
echo "Installation complete! 🎉"
echo ""
echo "To run the project, you need two terminal windows in WSL:"
echo ""
echo "Terminal 1 (Backend/API):"
echo "  source venv/bin/activate"
echo "  python app.py"
echo ""
echo "Terminal 2 (Frontend/Next.js):"
echo "  npm run dev"
echo "==================================="
