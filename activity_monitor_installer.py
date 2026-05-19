import os
import sys
import requests
import zipfile
import tempfile
import shutil
import subprocess
from pathlib import Path
import tkinter as tk
from tkinter import messagebox, ttk
import threading
import queue
import ctypes

class ActivityMonitorInstaller:
    """
    Activity Monitor 애플리케이션을 위한 개선된 설치 프로그램입니다.
    스레드에 안전한 UI 업데이트, 표준 설치 경로, 안전한 업데이트 절차,
    그리고 안정성과 유지보수성을 위해 리팩토링된 코드를 포함합니다.
    """
    def __init__(self):
        # --- 핵심 설정 ---
        self.github_user = "Luvxy"
        self.github_repo = "program"
        self.release_url = f"https://api.github.com/repos/{self.github_user}/{self.github_repo}/releases/latest"
        self.app_name = "ActivityMonitor"
        self.executable_name = "ActivityMonitor.exe"  # 특정 실행 파일 이름 가정
        self.zip_file_name = "ActivityMonitor_Release.zip"

        # 표준 경로인 %LOCALAPPDATA%를 설치 경로로 사용
        local_app_data = os.getenv('LOCALAPPDATA')
        if not local_app_data:
            local_app_data = os.path.expanduser("~") # 예외적인 경우 홈 디렉토리 사용
        self.install_path = os.path.join(local_app_data, self.app_name)

        # --- UI 설정 ---
        self.root = tk.Tk()
        self.root.title(f"{self.app_name} 설치 프로그램")
        self.root.geometry("500x500")
        self.root.resizable(False, False)
        self.root.attributes('-alpha', 0.0) # 페이드인을 위해 초기 투명도 0으로 설정

        # --- 스레드 안전 통신 ---
        self.ui_queue = queue.Queue()

        self.setup_ui()
        self.process_ui_queue()

    def setup_ui(self):
        """설치 프로그램의 메인 GUI를 설정합니다."""
        main_frame = tk.Frame(self.root, bg='#2d3748', padx=20, pady=20)
        main_frame.pack(fill='both', expand=True)

        tk.Label(main_frame, text=self.app_name, font=("맑은 고딕", 24, "bold"), fg='white', bg='#2d3748').pack(pady=(0, 5))
        tk.Label(main_frame, text="Windows 활동 모니터링 프로그램", font=("맑은 고딕", 12), fg='#a0aec0', bg='#2d3748').pack(pady=(0, 20))

        desc_text = """
• 실시간 활동 모니터링
• Top 10 차트 시각화
• 스마트 카테고리 분류
• 시스템 트레이 연동
• 100% 안전한 오픈소스 프로그램
        """
        tk.Label(main_frame, text="주요 기능:", font=("맑은 고딕", 11, "bold"), fg='white', bg='#2d3748', justify='left').pack(anchor='w')
        tk.Label(main_frame, text=desc_text, font=("맑은 고딕", 10), fg='#e2e8f0', bg='#2d3748', justify='left').pack(anchor='w', pady=(0, 20), padx=10)

        path_frame = tk.Frame(main_frame, bg='#2d3748')
        path_frame.pack(fill='x', pady=(0, 20))
        tk.Label(path_frame, text="설치 경로:", font=("맑은 고딕", 10), fg='white', bg='#2d3748').pack(anchor='w')
        self.path_var = tk.StringVar(value=self.install_path)
        tk.Entry(path_frame, textvariable=self.path_var, font=("맑은 고딕", 10), width=50, state='readonly', relief='solid', borderwidth=1).pack(fill='x', pady=(5, 0))

        self.progress_var = tk.DoubleVar()
        ttk.Style().configure("TProgressbar", thickness=15, troughcolor='#4a5568', background='#4299e1')
        self.progress_bar = ttk.Progressbar(main_frame, variable=self.progress_var, maximum=100, length=400, style="TProgressbar")
        self.progress_bar.pack(pady=(0, 10))

        self.status_var = tk.StringVar(value="설치 준비 완료.")
        self.status_label = tk.Label(main_frame, textvariable=self.status_var, font=("맑은 고딕", 10), fg='#68d391', bg='#2d3748')
        self.status_label.pack(pady=(0, 20))

        button_frame = tk.Frame(main_frame, bg='#2d3748')
        button_frame.pack()

        # 버튼 색상 및 호버 효과 설정
        install_normal_color, install_hover_color = '#4299e1', '#3182ce'
        exit_normal_color, exit_hover_color = '#e53e3e', '#c53030'

        self.install_button = tk.Button(button_frame, text="설치 시작", font=("맑은 고딕", 12, "bold"), bg=install_normal_color, fg='white', padx=40, pady=10, command=self.start_installation, relief='flat', activebackground=install_hover_color, activeforeground='white')
        self.install_button.pack(side='left', padx=(0, 10))
        self.exit_button = tk.Button(button_frame, text="종료", font=("맑은 고딕", 12), bg=exit_normal_color, fg='white', padx=40, pady=10, command=self.root.quit, relief='flat', activebackground=exit_hover_color, activeforeground='white')
        self.exit_button.pack(side='left')

        self.install_button.bind("<Enter>", lambda e: e.widget.config(bg=install_hover_color))
        self.install_button.bind("<Leave>", lambda e: e.widget.config(bg=install_normal_color))
        self.exit_button.bind("<Enter>", lambda e: e.widget.config(bg=exit_hover_color))
        self.exit_button.bind("<Leave>", lambda e: e.widget.config(bg=exit_normal_color))

    def process_ui_queue(self):
        """작업 스레드로부터 메시지를 받아 안전하게 UI를 업데이트합니다."""
        try:
            while True:
                task, args = self.ui_queue.get_nowait()
                task(*args)
        except queue.Empty:
            pass
        finally:
            self.root.after(100, self.process_ui_queue)
    
    def _animate_progress(self, target_value):
        """진행률 바를 부드럽게 업데이트합니다."""
        current_value = self.progress_var.get()
        if abs(current_value - target_value) < 0.5:
            self.progress_var.set(target_value)
            return

        new_value = current_value + (target_value - current_value) * 0.1
        self.progress_var.set(new_value)
        self.root.after(10, lambda: self._animate_progress(target_value))

    def _queue_update_status(self, message, progress=None):
        """상태 업데이트를 큐에 넣습니다."""
        self.status_var.set(message)
        if progress is not None:
            self._animate_progress(progress)
        self.root.update_idletasks()

    def _queue_messagebox(self, msg_type, title, message):
        """메시지 박스 호출을 큐에 넣습니다."""
        if msg_type == 'error':
            messagebox.showerror(title, message)
        elif msg_type == 'info_and_open':
            messagebox.showinfo(title, message)
            self.open_install_folder()

    def start_installation(self):
        """설치 전 확인 및 스레드 생성을 담당합니다."""
        self.install_path = self.path_var.get()
        if os.path.exists(self.install_path):
            if not messagebox.askyesno("업데이트 확인",
                                       f"'{self.app_name}'이(가) 이미 설치되어 있습니다.\n\n"
                                       "기존 버전을 삭제하고 다시 설치하시겠습니까?"):
                return
        
        self.install_button.config(state='disabled')
        install_thread = threading.Thread(target=self.install_program)
        install_thread.daemon = True
        install_thread.start()

    def install_program(self):
        """별도 스레드에서 실행되는 메인 설치 로직입니다."""
        temp_dir = tempfile.mkdtemp()
        try:
            self.ui_queue.put((self._queue_update_status, ("최신 버전 정보를 가져오는 중...", 10)))
            response = requests.get(self.release_url, timeout=10)
            if response.status_code != 200:
                print(response)
                raise Exception("릴리즈 정보를 가져올 수 없습니다. 인터넷 연결을 확인하세요.")
            release_info = response.json()
            
            download_url = next((asset['browser_download_url'] for asset in release_info.get('assets', []) if asset['name'] == self.zip_file_name), None)
            if not download_url:
                raise Exception(f"'{self.zip_file_name}' 파일을 최신 릴리즈에서 찾을 수 없습니다.")
                
            zip_path = os.path.join(temp_dir, "app.zip")
            self._download_file(download_url, zip_path)
            
            self.ui_queue.put((self._queue_update_status, ("설치 폴더를 준비하는 중...", 60)))
            if os.path.exists(self.install_path):
                shutil.rmtree(self.install_path)
            os.makedirs(self.install_path, exist_ok=True)
            
            self.ui_queue.put((self._queue_update_status, ("파일 압축을 해제하는 중...", 80)))
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(self.install_path)
                
            self.ui_queue.put((self._queue_update_status, ("바로가기를 생성하는 중...", 90)))
            self._create_shortcuts()
            
            self.ui_queue.put((self._queue_update_status, ("설치가 완료되었습니다!", 100)))
            self.ui_queue.put((self._queue_messagebox, ('info_and_open', "설치 완료",
                                                        f"{self.app_name}이(가) 성공적으로 설치되었습니다.\n\n확인 버튼을 누르면 설치 폴더가 열리고 프로그램이 종료됩니다.")))
        except Exception as e:
            self.ui_queue.put((self._queue_messagebox, ('error', "설치 오류", f"오류가 발생했습니다:\n{str(e)}")))
            self.ui_queue.put((self._queue_update_status, ("설치에 실패했습니다.", 0)))
        finally:
            shutil.rmtree(temp_dir)
            # 설치 버튼 상태 변경도 UI 스레드에서 안전하게 처리
            self.ui_queue.put((self._enable_install_button, ()))

    def _enable_install_button(self):
        """UI 스레드에서 설치 버튼을 다시 활성화합니다."""
        try:
            self.install_button.config(state='normal')
        except Exception:
            # 예외 발생 시에도 설치기 전체가 죽지 않도록 방어
            pass

    def _download_file(self, url, local_path):
        """파일을 다운로드하고 진행률 바를 업데이트합니다."""
        try:
            with requests.get(url, stream=True, timeout=30) as r:
                r.raise_for_status()
                total_size = int(r.headers.get('content-length', 0))
                downloaded = 0
                with open(local_path, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            progress = 30 + (downloaded / total_size) * 30
                            self.ui_queue.put((self._queue_update_status, (f"다운로드 중... {downloaded//1024**2}MB / {total_size//1024**2}MB", progress)))
        except requests.exceptions.RequestException as e:
            raise Exception(f"다운로드 실패: {e}")

    def _find_executable(self):
        """메인 실행 파일의 경로를 찾습니다."""
        exe_path = os.path.join(self.install_path, self.executable_name)
        return exe_path if os.path.exists(exe_path) else None

    def _create_shortcuts(self):
        """바탕화면 및 시작 메뉴 바로가기를 생성합니다."""
        exe_path = self._find_executable()
        if not exe_path:
            print("경고: 실행 파일을 찾을 수 없어 바로가기 생성을 건너뜁니다.")
            return

        desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        start_menu = os.path.join(os.environ['APPDATA'], "Microsoft", "Windows", "Start Menu", "Programs")
        
        self._create_shortcut(os.path.join(desktop, f"{self.app_name}.lnk"), exe_path)
        self._create_shortcut(os.path.join(start_menu, f"{self.app_name}.lnk"), exe_path)
        
    def _create_shortcut(self, shortcut_path, target_path):
        """PowerShell을 사용하여 단일 바로가기를 생성합니다."""
        try:
            ps_script = f'''
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("{shortcut_path}")
$Shortcut.TargetPath = "{target_path}"
$Shortcut.WorkingDirectory = "{self.install_path}"
$Shortcut.Description = "{self.app_name} - 활동 모니터링 프로그램"
$Shortcut.Save()
'''
            subprocess.run(["powershell", "-Command", ps_script], capture_output=True, text=True, check=True)
        except Exception as e:
            print(f"바로가기 생성 실패 ({shortcut_path}): {e}")

    def open_install_folder(self):
        """설치된 폴더를 파일 탐색기에서 열고 프로그램을 종료합니다."""
        try:
            os.startfile(self.install_path)
        except Exception as e:
            print(f"폴더를 여는 데 실패했습니다: {e}")
            self.ui_queue.put((self._queue_messagebox, ('info', "정보", f"설치 폴더:\n{self.install_path}")))
        finally:
            self.root.quit()
            
    def fade_in(self, alpha=0.0):
        """창을 부드럽게 나타나게 합니다."""
        if alpha < 1.0:
            alpha = min(alpha + 0.05, 1.0)
            self.root.attributes('-alpha', alpha)
            self.root.after(15, lambda: self.fade_in(alpha))

    def run(self):
        """Tkinter 이벤트 루프를 시작합니다."""
        self.fade_in()
        self.root.mainloop()

if __name__ == "__main__":
    try:
        # 고해상도 디스플레이에서 UI 스케일링 개선
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        pass
    installer = ActivityMonitorInstaller()
    installer.run()