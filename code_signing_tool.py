import subprocess
import sys
import os

def check_signing_tools():
    """코드 서명 도구 설치 상태 확인"""
    print("🔍 코드 서명 도구 확인 중...")
    
    tools = {
        "signtool": "signtool.exe",
        "certlm": "certlm.msc",
        "makecert": "makecert.exe"
    }
    
    available_tools = []
    
    for tool_name, tool_cmd in tools.items():
        try:
            result = subprocess.run([tool_cmd, "/?"], 
                                  capture_output=True, 
                                  text=True, 
                                  timeout=5)
            if result.returncode == 0 or "usage" in result.stderr.lower():
                available_tools.append(tool_name)
                print(f"✅ {tool_name} - 사용 가능")
            else:
                print(f"❌ {tool_name} - 사용 불가")
        except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.CalledProcessError):
            print(f"❌ {tool_name} - 설치되지 않음")
    
    return available_tools

def create_test_certificate():
    """테스트용 자체 서명 인증서 생성 (개발용)"""
    print("\n🔧 테스트용 인증서 생성 시도...")
    
    try:
        # PowerShell을 사용한 자체 서명 인증서 생성
        ps_script = '''
        $cert = New-SelfSignedCertificate -Subject "CN=ActivityMonitor Test" -Type CodeSigning -KeyUsage DigitalSignature -FriendlyName "ActivityMonitor Test Certificate" -CertStoreLocation "Cert:\\CurrentUser\\My" -KeyExportPolicy Exportable -KeySpec Signature -KeyLength 2048 -KeyAlgorithm RSA -HashAlgorithm SHA256
        $pwd = ConvertTo-SecureString -String "testpassword123" -Force -AsPlainText
        $path = "ActivityMonitor_TestCert.pfx"
        Export-PfxCertificate -Cert $cert -FilePath $path -Password $pwd
        Write-Host "인증서 생성 완료: $path"
        '''
        
        result = subprocess.run(["powershell", "-Command", ps_script], 
                              capture_output=True, text=True, check=True)
        
        print("✅ 테스트 인증서 생성 성공!")
        print("📁 파일: ActivityMonitor_TestCert.pfx")
        print("🔑 비밀번호: testpassword123")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ 인증서 생성 실패: {e}")
        print("💡 관리자 권한으로 실행해보세요.")
        return False

def sign_executable_test():
    """테스트 인증서로 실행파일 서명"""
    exe_path = "dist/ActivityMonitor_Installer.exe"
    cert_path = "ActivityMonitor_TestCert.pfx"
    
    if not os.path.exists(exe_path):
        print(f"❌ 실행파일을 찾을 수 없습니다: {exe_path}")
        return False
    
    if not os.path.exists(cert_path):
        print(f"❌ 인증서를 찾을 수 없습니다: {cert_path}")
        return False
    
    print(f"\n🔐 실행파일 서명 중: {exe_path}")
    
    try:
        cmd = [
            "signtool", "sign",
            "/f", cert_path,
            "/p", "testpassword123",
            "/fd", "SHA256",
            "/t", "http://timestamp.digicert.com",
            exe_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        print("✅ 서명 완료!")
        print("📝 서명 확인 중...")
        
        # 서명 확인
        verify_cmd = ["signtool", "verify", "/pa", "/v", exe_path]
        verify_result = subprocess.run(verify_cmd, capture_output=True, text=True)
        
        if verify_result.returncode == 0:
            print("✅ 서명 검증 성공!")
            return True
        else:
            print("⚠️ 서명 검증 실패 (테스트 인증서는 신뢰되지 않을 수 있음)")
            return True
            
    except subprocess.CalledProcessError as e:
        print(f"❌ 서명 실패: {e}")
        return False

def show_certificate_info():
    """인증서 정보 표시"""
    exe_path = "dist/ActivityMonitor_Installer.exe"
    
    if not os.path.exists(exe_path):
        return
    
    print(f"\n📋 {exe_path} 서명 정보:")
    
    try:
        ps_script = f'Get-AuthenticodeSignature "{exe_path}" | Format-List'
        result = subprocess.run(["powershell", "-Command", ps_script], 
                              capture_output=True, text=True)
        print(result.stdout)
    except Exception as e:
        print(f"정보 조회 실패: {e}")

def main():
    print("🔐 Activity Monitor 코드 서명 도구")
    print("=" * 50)
    
    # 1. 서명 도구 확인
    available_tools = check_signing_tools()
    
    if "signtool" not in available_tools:
        print("\n💡 SignTool이 설치되지 않았습니다.")
        print("Windows SDK 또는 Visual Studio를 설치하세요.")
        print("다운로드: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/")
        return
    
    # 2. 현재 서명 상태 확인
    show_certificate_info()
    
    # 3. 사용자 선택
    print("\n🔧 수행할 작업을 선택하세요:")
    print("1. 테스트 인증서 생성")
    print("2. 테스트 서명 적용")
    print("3. 서명 정보 확인만")
    print("4. 종료")
    
    choice = input("\n선택 (1-4): ").strip()
    
    if choice == "1":
        create_test_certificate()
    elif choice == "2":
        if create_test_certificate():
            sign_executable_test()
    elif choice == "3":
        show_certificate_info()
    elif choice == "4":
        print("종료합니다.")
    else:
        print("잘못된 선택입니다.")

if __name__ == "__main__":
    main()