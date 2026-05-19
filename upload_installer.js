import admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import * as fs from 'fs';
import * as path from 'path';

// Firebase Admin SDK 초기화
if (!admin.apps.length) {
  // Firebase 프로젝트 설정에서 서비스 계정 키를 다운로드하여 사용
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: 'monitor-3jp.appspot.com'  // 실제 프로젝트 ID로 변경
  });
}

const storage = getStorage();
const bucket = storage.bucket();

/**
 * Firebase Storage에 설치파일 업로드
 */
async function uploadInstaller() {
  try {
    const installerPath = '../public/ActivityMonitor_Installer.exe';
    const destinationPath = 'installers/ActivityMonitor_Installer.exe';
    
    console.log('📁 설치파일 업로드 시작...');
    
    // 파일 업로드
    await bucket.upload(installerPath, {
      destination: destinationPath,
      metadata: {
        contentType: 'application/octet-stream',
        metadata: {
          uploadedAt: new Date().toISOString(),
          version: '1.0',
          description: 'Activity Monitor Installer'
        }
      }
    });
    
    // 공개 읽기 권한 설정
    await bucket.file(destinationPath).makePublic();
    
    // 다운로드 URL 생성
    const publicUrl = `https://storage.googleapis.com/monitor-3jp.appspot.com/${destinationPath}`;
    
    console.log('✅ 업로드 완료!');
    console.log('🔗 다운로드 URL:', publicUrl);
    
    return publicUrl;
    
  } catch (error) {
    console.error('❌ 업로드 실패:', error);
    throw error;
  }
}

/**
 * 설치파일 정보 조회
 */
async function getInstallerInfo() {
  try {
    const file = bucket.file('installers/ActivityMonitor_Installer.exe');
    const [metadata] = await file.getMetadata();
    
    return {
      name: metadata.name,
      size: metadata.size,
      updated: metadata.updated,
      downloadUrl: `https://storage.googleapis.com/monitor-3jp.appspot.com/${metadata.name}`
    };
  } catch (error) {
    console.error('파일 정보 조회 실패:', error);
    return null;
  }
}

// 스크립트 직접 실행시
if (import.meta.url === `file://${process.argv[1]}`) {
  uploadInstaller()
    .then(url => {
      console.log('\n🎉 업로드 성공!');
      console.log('이제 웹사이트에서 이 URL을 사용할 수 있습니다:');
      console.log(url);
    })
    .catch(error => {
      console.error('\n💥 업로드 실패:', error.message);
      process.exit(1);
    });
}

export { uploadInstaller, getInstallerInfo };