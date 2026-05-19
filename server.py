import asyncio
import websockets
import json
import threading
import time
import csv
import os
from datetime import datetime

try:
    import psutil
    from pygetwindow import getActiveWindow
except ImportError:
    print("Required libraries are not installed. Please run 'pip install pygetwindow psutil websockets'.")
    exit()

# --- Global State ---
MONITORING_STATE = {"is_running": False}
CONNECTED_CLIENTS = set()
LAST_ACTIVITY_DATA = {"data": None}

# --- Activity Monitoring Logic ---
def monitor_loop():
    last_activity = None
    start_time = None

    while True:
        if MONITORING_STATE["is_running"]:
            window_title, process_name = get_active_window_info()
            current_activity = get_app_name(window_title, process_name)

            if current_activity is None or current_activity == "알 수 없음":
                time.sleep(1)
                continue
            
            # Send real-time activity to clients
            asyncio.run(send_to_clients({"type": "activity_update", "activity": current_activity}))

            if current_activity != last_activity:
                if last_activity is not None and start_time is not None:
                    end_time = datetime.now()
                    duration = (end_time - start_time).total_seconds()
                    if duration > 1:
                        activity_data = {"start_time": start_time, "end_time": end_time, "duration": duration, "activity": last_activity}
                        save_activity(activity_data)
                        LAST_ACTIVITY_DATA["data"] = None

                last_activity = current_activity
                start_time = datetime.now()
                LAST_ACTIVITY_DATA["data"] = {"start_time": start_time, "activity": last_activity}
        
        time.sleep(1)

# --- Utility Functions ---
def get_active_window_info():
    try:
        active_window = getActiveWindow()
        if active_window:
            return active_window.title, psutil.Process(active_window._hWnd).name()
    except Exception:
        pass
    return None, None

def get_app_name(window_title, process_name):
    if not window_title and not process_name: return "알 수 없음"
    title_lower = window_title.lower() if window_title else ""
    proc_lower = process_name.lower() if process_name else ""
    if "chrome" in proc_lower or "msedge" in proc_lower:
        parts = window_title.split(' - ')
        if len(parts) > 1 and any(b in parts[-1].lower() for b in ['google chrome', 'microsoft edge']):
            return f"{parts[-1]}: {parts[0]}"
        return window_title
    return window_title or process_name

def save_activity(activity_data):
    filename = "raw_activity_log.csv"
    fieldnames = ['시작 시간', '종료 시간', '사용 시간(초)', '요일', '활동 내용']
    try:
        file_exists_and_not_empty = os.path.isfile(filename) and os.path.getsize(filename) > 0
        with open(filename, mode='a', newline='', encoding='utf-8-sig') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            if not file_exists_and_not_empty:
                writer.writeheader()
            weekdays = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"]
            row_data = {
                '시작 시간': activity_data["start_time"].strftime('%Y-%m-%d %H:%M:%S'),
                '종료 시간': activity_data["end_time"].strftime('%Y-%m-%d %H:%M:%S'),
                '사용 시간(초)': int(activity_data["duration"]),
                '요일': weekdays[activity_data["start_time"].weekday()],
                '활동 내용': activity_data["activity"]
            }
            writer.writerow(row_data)
            print(f"Saved: {row_data['활동 내용']} - {row_data['사용 시간(초)']}s")
    except Exception as e:
        print(f"Error saving file: {e}")


# --- WebSocket Server Logic ---
async def send_to_clients(message):
    if CONNECTED_CLIENTS:
        await asyncio.gather(*[client.send(json.dumps(message)) for client in CONNECTED_CLIENTS])

async def handler(websocket, path):
    CONNECTED_CLIENTS.add(websocket)
    print(f"Client connected: {websocket.remote_address}")
    try:
        # Send initial state
        await websocket.send(json.dumps({
            "type": "status_update", 
            "is_running": MONITORING_STATE["is_running"]
        }))
        
        async for message in websocket:
            data = json.loads(message)
            if data.get("command") == "toggle_monitoring":
                MONITORING_STATE["is_running"] = not MONITORING_STATE["is_running"]
                print(f"Monitoring state changed to: {MONITORING_STATE['is_running']}")

                # If stopping, save the last activity
                if not MONITORING_STATE['is_running'] and LAST_ACTIVITY_DATA["data"]:
                    last_data = LAST_ACTIVITY_DATA["data"]
                    if 'start_time' in last_data:
                        end_time = datetime.now()
                        duration = (end_time - last_data['start_time']).total_seconds()
                        if duration > 1:
                            activity_data = {"start_time": last_data['start_time'], "end_time": end_time, "duration": duration, "activity": last_data['activity']}
                            save_activity(activity_data)
                            LAST_ACTIVITY_DATA["data"] = None
                
                await send_to_clients({
                    "type": "status_update", 
                    "is_running": MONITORING_STATE["is_running"]
                })
    finally:
        CONNECTED_CLIENTS.remove(websocket)
        print(f"Client disconnected: {websocket.remote_address}")

async def main():
    # Start the monitoring thread
    monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
    monitor_thread.start()

    # Start the WebSocket server
    async with websockets.serve(handler, "localhost", 8765):
        print("WebSocket server started at ws://localhost:8765")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Server is shutting down.")
