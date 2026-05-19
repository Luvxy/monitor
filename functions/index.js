const functions = require("firebase-functions");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const https = require("https");
const { defineString } = require("firebase-functions/params");

// 표준 초기화 방식으로 복구 (GCP 환경 자동 감지)
admin.initializeApp();
const db = getFirestore("sigan");

// 모든 2세대 함수의 기본 리전을 서울로 설정
setGlobalOptions({ region: "asia-northeast3" });

// CORS 설정을 위한 미들웨어
const cors = require("cors")({ origin: true });

// Firebase Secrets Manager에서 API 키를 안전하게 불러옵니다.
const apiKey = defineString("GEMINI_KEY");
const removeBgKey = defineString("REMOVEBG_KEY");

/**
 * 사용자의 활동 데이터를 기반으로 AI 페르소나 텍스트를 생성하는 함수.
 */
exports.generatePersona = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    if (request.method !== "POST") {
      return response.status(405).send("Method Not Allowed");
    }

    if (!apiKey.value()) {
      console.error("API Key가 설정되지 않았습니다.");
      return response.status(500).send("서버 설정 오류: API 키가 없습니다.");
    }

    const postData = JSON.stringify({
      contents: request.body.contents,
      systemInstruction: request.body.systemInstruction,
      generationConfig: request.body.generationConfig,
    });

    const options = {
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey.value()}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsedData = JSON.parse(data);
          const personaText = parsedData.candidates?.[0]?.content?.parts?.[0]?.text;

          if (personaText) {
            response.status(200).send({ persona: personaText });
          } else {
            console.error("AI가 텍스트를 생성하지 않았습니다. 응답:", data);
            response.status(500).send({
              error: "AI가 응답을 생성하지 못했습니다.",
              details: parsedData
            });
          }
        } catch (error) {
          console.error("AI 응답 파싱 중 오류 발생:", error, "원본 데이터:", data);
          response.status(500).send({
            error: "AI 응답 처리 중 오류가 발생했습니다.",
            details: data
          });
        }
      });
    });

    req.on("error", (error) => {
      console.error("Gemini API 호출 중 오류 발생:", error);
      response.status(500).send({ error: "Internal Server Error" });
    });

    req.write(postData);
    req.end();
  });
});


/**
 * AI 페르소나 텍스트를 기반으로 캐릭터 이미지를 생성하는 함수.
 * [수정됨] Imagen 대신 gemini-2.5-flash-image-preview 모델을 사용합니다.
 */
exports.generateCharacter = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    console.log("generateCharacter 함수가 호출되었습니다.");

    if (request.method !== "POST") {
      return response.status(405).send("Method Not Allowed");
    }

    if (!apiKey.value()) {
      console.error("API Key가 설정되지 않았습니다.");
      return response.status(500).send({ error: "서버 설정 오류: API 키가 없습니다." });
    }

    const prompt = request.body.prompt || "A cute cartoon character";
    console.log("Gemini Image API 요청 프롬프트:", prompt);

    // 텍스트 없는 이미지 생성을 위한 프롬프트 개선
    const enhancedPrompt = `${prompt}, no text, no words, no letters, no writing, no typography, pure visual character only, transparent background, no background, isolated character, PNG style, white background for easy removal, clean illustration without any textual elements`;

    // Gemini 이미지 생성 API에 보낼 요청 데이터 구성
    const postData = JSON.stringify({
      contents: [{
        parts: [{ text: enhancedPrompt }]
      }],
      generationConfig: {
        responseModalities: ['IMAGE']
      },
    });

    // Gemini 이미지 생성 API 엔드포인트 및 옵션 설정
    const options = {
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey.value()}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log("Gemini Image API 응답 상태 코드:", res.statusCode);

        try {
          if (res.statusCode === 200) {
            const parsedData = JSON.parse(data);
            // Gemini 이미지 응답 구조에서 Base64 인코딩된 이미지 데이터를 추출합니다.
            const imagePart = parsedData.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            const base64Image = imagePart?.inlineData?.data;

            if (base64Image) {
              console.log("Gemini로부터 이미지를 성공적으로 받았습니다.");
              response.status(200).send({
                imageData: base64Image,
                success: true
              });
            } else {
              console.error("Gemini 응답에 이미지 데이터가 없습니다. 응답:", data);
              response.status(500).send({ error: "이미지 데이터가 응답에 포함되지 않았습니다." });
            }
          } else {
            console.error("Gemini Image API 에러 응답:", data);
            response.status(res.statusCode).send({ error: "이미지 생성 중 오류가 발생했습니다." });
          }
        } catch (error) {
          console.error("Gemini 이미지 응답 파싱 중 오류 발생:", error, "원본 데이터:", data);
          response.status(500).send({ error: "이미지 응답 처리 중 오류가 발생했습니다." });
        }
      });
    });

    req.on('error', (error) => {
      console.error("Gemini Image API 호출 중 오류 발생:", error);
      response.status(500).send({ error: "이미지 생성 서비스에 연결할 수 없습니다." });
    });

    req.write(postData);
    req.end();
  });
});

/**
 * 캐릭터 이미지를 기반으로 어울리는 배경을 생성하는 함수
 */
exports.generateBackground = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    console.log("generateBackground 함수가 호출되었습니다.");

    if (request.method !== "POST") {
      return response.status(405).send("Method Not Allowed");
    }

    if (!apiKey.value()) {
      console.error("API Key가 설정되지 않았습니다.");
      return response.status(500).send({ error: "서버 설정 오류: API 키가 없습니다." });
    }

    const characterImageData = request.body.characterImageData;
    const persona = request.body.persona || "";

    console.log("파스텔 배경 생성을 위한 프롬프트:", persona);

    // 파스텔 톤 그라데이션 배경 생성 프롬프트 (캐릭터 이미지 없이)
    const backgroundPrompt = persona; // 클라이언트에서 이미 완성된 프롬프트를 전송

    // Gemini 이미지 생성 API에 보낼 요청 데이터 구성 (캐릭터 이미지 제외)
    const postData = JSON.stringify({
      contents: [{
        parts: [{ text: backgroundPrompt }]
      }],
      generationConfig: {
        responseModalities: ['IMAGE']
      },
    });

    // Gemini 이미지 생성 API 엔드포인트 및 옵션 설정
    const options = {
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey.value()}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log("Gemini Background API 응답 상태 코드:", res.statusCode);

        try {
          if (res.statusCode === 200) {
            const parsedData = JSON.parse(data);
            // Gemini 이미지 응답 구조에서 Base64 인코딩된 이미지 데이터를 추출합니다.
            const imagePart = parsedData.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            const base64Image = imagePart?.inlineData?.data;

            if (base64Image) {
              console.log("Gemini로부터 배경 이미지를 성공적으로 받았습니다.");
              response.status(200).send({
                backgroundImageData: base64Image,
                success: true
              });
            } else {
              console.error("Gemini 응답에 배경 이미지 데이터가 없습니다. 응답:", data);
              response.status(500).send({ error: "배경 이미지 데이터가 응답에 포함되지 않았습니다." });
            }
          } else {
            console.error("Gemini Background API 에러 응답:", data);
            response.status(res.statusCode).send({ error: "배경 이미지 생성 중 오류가 발생했습니다." });
          }
        } catch (error) {
          console.error("Gemini 배경 이미지 응답 파싱 중 오류 발생:", error, "원본 데이터:", data);
          response.status(500).send({ error: "배경 이미지 응답 처리 중 오류가 발생했습니다." });
        }
      });
    });

    req.on('error', (error) => {
      console.error("Gemini Background API 호출 중 오류 발생:", error);
      response.status(500).send({ error: "배경 이미지 생성 서비스에 연결할 수 없습니다." });
    });

    req.write(postData);
    req.end();
  });
});


/**
 * 이미지 배경 제거 함수 (Remove.bg API 사용)
 */
exports.removeBackground = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    if (request.method !== "POST") {
      return response.status(405).send("Method Not Allowed");
    }

    if (!removeBgKey.value()) {
      console.error("Remove.bg API Key가 설정되지 않았습니다.");
      return response.status(500).send({ error: "서버 설정 오류: Remove.bg API 키가 없습니다." });
    }

    const imageData = request.body.imageData;
    if (!imageData) {
      return response.status(400).send({ error: "이미지 데이터가 필요합니다." });
    }

    // Remove.bg API 사용 (무료 API 키 필요)
    const postData = JSON.stringify({
      image_file_b64: imageData,
      size: "auto"
    });

    const options = {
      hostname: "api.remove.bg",
      path: "/v1.0/removebg",
      method: "POST",
      headers: {
        "X-Api-Key": removeBgKey.value(),
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      // 바이너리 응답을 안전하게 처리하기 위해 인코딩을 binary로 설정
      res.setEncoding("binary");
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          // Remove.bg는 바이너리 데이터를 반환하므로 Base64로 인코딩
          const base64Image = Buffer.from(data, 'binary').toString('base64');
          response.status(200).send({
            imageData: base64Image,
            success: true
          });
        } else {
          console.error("Remove.bg API 에러:", data);
          response.status(res.statusCode).send({ error: "배경 제거 중 오류가 발생했습니다." });
        }
      });
    });

    req.on('error', (error) => {
      console.error("Remove.bg API 호출 중 오류:", error);
      response.status(500).send({ error: "배경 제거 서비스에 연결할 수 없습니다." });
    });

    req.write(postData);
    req.end();
  });
});


/**
 * 심층 AI 분석 및 코칭 함수 (Premium)
 * 사용자의 활동 요약을 기반으로 생산성 점수, 문제점, 해결책을 제시합니다.
 */
exports.generateDeepAnalysis = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    if (request.method !== "POST") {
      return response.status(405).send("Method Not Allowed");
    }

    if (!apiKey.value()) {
      return response.status(500).send({ error: "API Key가 설정되지 않았습니다." });
    }

    const { summary, topApp, usageTime } = request.body;

    // 프롬프트 구성
    const prompt = `
      당신은 냉철하고 분석적인 **'디지털 생산성 컨설턴트'**입니다.
      아래 사용자의 컴퓨터 활동 요약 데이터를 분석하여 심층 리포트를 JSON 형식으로 작성하세요.

      [사용자 데이터]
      - 총 사용 시간: ${usageTime}
      - 가장 많이 사용한 앱/사이트: ${topApp}
      - 활동 요약: ${summary}

      [요구사항]
      1. **productivityScore**: 0~100점 사이의 점수. (비생산적 활동이 많으면 낮게)
      2. **analysis**: 현재 패턴에 대한 3줄 내외의 날카로운 분석.
      3. **bottlenecks**: 생산성을 저해하는 주된 원인 3가지 (단어 또는 짧은 구).
      4. **actionableAdvice**: 즉시 실행 가능한 구체적인 조언 3가지.

      [출력 형식]
      반드시 오직 **JSON** 포맷만 출력하세요. 마크다운이나 다른 설명은 제외하세요.
      Example:
      {
        "productivityScore": 75,
        "analysis": "업무 시간 중 유튜브 시청 비중이 다소 높습니다...",
        "bottlenecks": ["잦은 유튜브 전환", "긴 작업 시간 대비 낮은 집중도"],
        "actionableAdvice": ["오후 2-4시에는 유튜브 차단 설정하기", "50분 작업 10분 휴식 루틴 도입"]
      }
    `;

    const postData = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json", // JSON 모드 강제
      }
    });

    const options = {
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.value()}`, // User updated model name in step 371
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsedData = JSON.parse(data);
          const contentText = parsedData.candidates?.[0]?.content?.parts?.[0]?.text;

          if (contentText) {
            // JSON 파싱 시도 (모델이 가끔 코드블록을 포함할 수 있으므로 정제)
            const cleanJsonText = contentText.replace(/```json/g, "").replace(/```/g, "").trim();
            const analysisResult = JSON.parse(cleanJsonText);

            response.status(200).send(analysisResult);
          } else {
            console.error("AI 응답 없음:", data);
            response.status(500).send({ error: "AI 분석 실패", details: parsedData });
          }
        } catch (error) {
          console.error("AI 응답 처리 오류:", error, data);
          response.status(500).send({ error: "분석 결과 처리 실패", details: error.toString() });
        }
      });
    });

    req.on("error", (error) => {
      console.error("API 요청 오류:", error);
      response.status(500).send({ error: "Internal Server Error" });
    });

    req.write(postData);
    req.end();
  });
});

const { onRequest } = require("firebase-functions/v2/https");

/**
 * 사용자의 익명 데이터(나이, 성별, 활동 TOP 5)를 빅데이터용으로 저장합니다. (V2)
 */
exports.saveUserStats = onRequest({ cors: true }, async (request, response) => {
  // POST 메서드만 허용
  if (request.method !== "POST") {
    return response.status(405).send("Method Not Allowed");
  }

  try {
    const { a, g, t } = request.body;
    console.log("saveUserStats 수신 데이터:", { a, g, t });

    // 필수 데이터 검증
    if (a === undefined || !g || !t) {
      console.warn("필수 필드 누락:", { a, g, t });
      return response.status(400).send({ error: "Missing required fields" });
    }

    // Firestore에 데이터 저장
    const docRef = await db.collection("user_stats").add({
      a: a,              // Age group
      g: g,              // Gender
      t: t,              // Top 5 Activities
      ts: admin.firestore.FieldValue.serverTimestamp() // Timestamp
    });

    console.log("Firestore 저장 성공. ID:", docRef.id);
    response.status(200).send({ success: true, id: docRef.id });
  } catch (error) {
    console.error("데이터 저장 중 오류 발생:", error);
    response.status(500).send({
      error: "Failed to save statistics",
      message: error.message,
      code: error.code || "unknown"
    });
  }
});

/**
 * 라운지에 이미지를 공유하는 함수
 */
exports.uploadLoungePost = onRequest({ cors: true }, async (request, response) => {
  if (request.method !== "POST") {
    return response.status(405).send("Method Not Allowed");
  }

  try {
    const { image, persona, age, gender } = request.body;
    if (!image || !persona || !age || !gender) {
      return response.status(400).send({ error: "Missing required fields" });
    }

    const bucket = admin.storage().bucket();
    const fileName = `lounge_images/${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
    const file = bucket.file(fileName);

    // Base64 이미지를 버퍼로 변환하여 업로드
    const buffer = Buffer.from(image.split(',')[1], 'base64');
    await file.save(buffer, {
      metadata: { contentType: 'image/png' },
      public: true
    });

    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    const docRef = await db.collection("lounge_posts").add({
      imageUrl,
      persona,
      age: parseInt(age),
      gender,
      likes: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    response.status(200).send({ success: true, id: docRef.id });
  } catch (error) {
    console.error("라운지 공유 오류:", error);
    response.status(500).send({ error: "Failed to upload lounge post", message: error.message });
  }
});

/**
 * 라운지 포스트 목록을 가져오는 함수
 */
exports.getLoungePosts = onRequest({ cors: true }, async (request, response) => {
  try {
    const snapshot = await db.collection("lounge_posts")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const posts = [];
    snapshot.forEach(doc => {
      posts.push({ id: doc.id, ...doc.data() });
    });

    response.status(200).send({ posts });
  } catch (error) {
    console.error("라운지 목록 조회 오류:", error);
    response.status(500).send({ error: "Failed to get lounge posts" });
  }
});

/**
 * 좋아요 토글 함수
 */
exports.toggleLike = onRequest({ cors: true }, async (request, response) => {
  if (request.method !== "POST") {
    return response.status(405).send("Method Not Allowed");
  }

  try {
    const { postId, userId, action } = request.body; // action: 'like' or 'unlike'
    if (!postId || !userId || !action) {
      return response.status(400).send({ error: "Missing required fields" });
    }

    const postRef = db.collection("lounge_posts").doc(postId);
    const likeRef = db.collection("lounge_likes").doc(`${postId}_${userId}`);

    const likeDoc = await likeRef.get();

    if (action === 'like') {
      if (likeDoc.exists) {
        return response.status(400).send({ error: "Already liked" });
      }
      await admin.firestore().runTransaction(async (transaction) => {
        transaction.set(likeRef, { userId, postId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        transaction.update(postRef, { likes: admin.firestore.FieldValue.increment(1) });
      });
    } else {
      if (!likeDoc.exists) {
        return response.status(400).send({ error: "Not liked yet" });
      }
      await admin.firestore().runTransaction(async (transaction) => {
        transaction.delete(likeRef);
        transaction.update(postRef, { likes: admin.firestore.FieldValue.increment(-1) });
      });
    }

    response.status(200).send({ success: true });
  } catch (error) {
    console.error("좋아요 처리 오류:", error);
    response.status(500).send({ error: "Failed to toggle like" });
  }
});
