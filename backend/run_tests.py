#!/usr/bin/env python3
"""
Test runner script for Pitch Detector
Handles dependency installation and test execution
"""
import subprocess
import sys
import os


def install_test_dependencies():
    """Install test dependencies"""
    print("📦 Installing test dependencies...")
    requirements_path = os.path.join(os.path.dirname(__file__), 'tests', 'requirements.txt')
    
    result = subprocess.run(
        [sys.executable, '-m', 'pip', 'install', '-r', requirements_path],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print("✅ Test dependencies installed successfully")
        return True
    else:
        print(f"❌ Failed to install test dependencies: {result.stderr}")
        return False


def run_tests():
    """Run all tests"""
    print("🧪 Running tests...")
    
    # Change to backend directory
    os.chdir(os.path.dirname(__file__))
    
    result = subprocess.run(
        [sys.executable, '-m', 'pytest', '-v', '--tb=short'],
        capture_output=False,
        text=True
    )
    
    return result.returncode == 0


def main():
    """Main test runner"""
    print("=" * 60)
    print("🎵 Pitch Detector - Test Suite")
    print("=" * 60)
    
    # Install dependencies
    if not install_test_dependencies():
        sys.exit(1)
    
    # Run tests
    if run_tests():
        print("\n✅ All tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()
