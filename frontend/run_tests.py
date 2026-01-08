#!/usr/bin/env python3
"""
Test runner script for frontend interactive features
"""
import subprocess
import sys
import os


def install_frontend_test_dependencies():
    """Install frontend test dependencies"""
    print("📦 Installing frontend test dependencies...")
    
    # Check if pytest is available in the backend's virtual environment
    venv_path = os.path.join(os.path.dirname(__file__), '..', 'backend', 'test_env', 'bin', 'pytest')
    
    if os.path.exists(venv_path):
        print("✅ Using backend test environment")
        return venv_path
    else:
        print("⚠️  Backend test environment not found, using system pytest")
        return 'pytest'


def run_frontend_tests():
    """Run frontend tests"""
    print("🧪 Running frontend tests...")
    
    # Change to frontend directory
    frontend_dir = os.path.dirname(__file__)
    tests_dir = os.path.join(frontend_dir, 'tests')
    
    result = subprocess.run(
        ['pytest', '-v', '--tb=short', tests_dir],
        capture_output=False,
        text=True,
        cwd=frontend_dir
    )
    
    return result.returncode == 0


def main():
    """Main test runner"""
    print("=" * 60)
    print("🎨 Pitch Detector - Frontend Interactive Tests")
    print("=" * 60)
    
    # Run tests
    success = run_frontend_tests()
    
    if success:
        print("\n✅ All frontend tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Some frontend tests failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()
