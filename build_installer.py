import subprocess
import sys
import os

def install_requirements():
    """필요한 패키지들을 설치합니다."""
    required_packages = [
        'requests',
        'tk',  # tkinter는 보통 기본 설치되어 있음
    ]
    
    for package in required_packages:
        try:
            print(f"Installing {package}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", package])
            print(f"✅ {package} installed successfully")
        except subprocess.CalledProcessError:
            print(f"❌ Failed to install {package}")
            return False
    
    return True

def create_installer_exe():
    """설치 프로그램을 실행파일로 빌드합니다."""
    try:
        print("🔨 Creating installer executable...")
        
        # PyInstaller로 설치 프로그램 빌드
        cmd = [
            "pyinstaller",
            "--onefile",
            "--windowed",
            "--name=ActivityMonitor_Installer",
            "--icon=image/icon.ico",
            "activity_monitor_installer.py"
        ]
        
        subprocess.check_call(cmd)
        print("✅ Installer executable created successfully!")
        print("📁 Location: dist/ActivityMonitor_Installer.exe")
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to create installer: {e}")
        return False
    except FileNotFoundError:
        print("❌ PyInstaller not found. Installing...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
        return create_installer_exe()

if __name__ == "__main__":
    print("🚀 Activity Monitor Installer Builder")
    print("=" * 50)
    
    # 1. 필요한 패키지 설치
    print("📦 Installing required packages...")
    if not install_requirements():
        print("❌ Failed to install required packages")
        sys.exit(1)
    
    # 2. 설치 프로그램 빌드
    if create_installer_exe():
        print("\n🎉 Build completed successfully!")
        print("\nNext steps:")
        print("1. Upload 'dist/ActivityMonitor_Installer.exe' to your web server")
        print("2. Update the download button in public/index.html")
        print("3. Users can download and run the installer")
    else:
        print("\n❌ Build failed")
        sys.exit(1)