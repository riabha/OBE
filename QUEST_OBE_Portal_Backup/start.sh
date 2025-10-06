#!/bin/bash

echo "========================================"
echo "   QUEST OBE Portal - Quick Start"
echo "========================================"
echo

echo "[1] Installing dependencies..."
npm install

echo
echo "[2] Starting server on port 30005..."
echo
echo "Your QUEST OBE Portal will be available at:"
echo "http://localhost:30005"
echo
echo "Login page: http://localhost:30005/login"
echo
echo "Test Accounts:"
echo "- Admin: admin@quest.edu.pk / admin123"
echo "- Student: student@quest.edu.pk / pass"
echo "- Teacher: teacher@quest.edu.pk / pass"
echo "- Focal: focal@quest.edu.pk / pass"
echo "- Chairman: chairman@quest.edu.pk / pass"
echo "- Dean: dean@quest.edu.pk / pass"
echo "- Controller: controller@quest.edu.pk / pass"
echo
echo "Press Ctrl+C to stop the server"
echo "========================================"
echo

node server.js
