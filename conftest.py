"""
conftest.py  (project root)
Ensures the project root is on sys.path so that `from ai.xxx import ...`
works in all pytest test modules regardless of the working directory.
"""
import sys
import os

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
