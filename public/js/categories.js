// 카테고리 설정 (Python activity_categorizer.py와 동일) - JSON 파일에서 로드
let categoryConfig = null;

async function loadCategoryConfig() {
    if (categoryConfig) return categoryConfig;
    try {
        const res = await fetch('/activity_categories.json', { cache: 'no-cache' });
        if (!res.ok) {
            console.error('카테고리 설정 파일 로드 실패:', res.status, res.statusText);
            throw new Error('카테고리 설정을 불러오지 못했습니다.');
        }
        categoryConfig = await res.json();
        return categoryConfig;
    } catch (error) {
        console.error('카테고리 설정 로드 중 오류:', error);
        // 최소한의 안전장치: null 유지 시 카테고리 분류를 생략하고 원본 활동명을 사용
        categoryConfig = null;
        return null;
    }
}

function matchesCategory(originalName, lowerName, categoryInfo) {
    // exact_match 확인
    if (categoryInfo.exact_match) {
        if (categoryInfo.exact_match.some(match => lowerName === match.toLowerCase())) {
            return true;
        }
    }

    // keywords 확인
    if (categoryInfo.keywords) {
        const keywords = categoryInfo.keywords.map(kw => kw.toLowerCase());

        // exclude 키워드가 있는 경우 제외
        if (categoryInfo.exclude) {
            const excludeKeywords = categoryInfo.exclude.map(kw => kw.toLowerCase());
            if (excludeKeywords.some(excludeKw => lowerName.includes(excludeKw))) {
                return false;
            }
        }

        // any_of가 있는 경우 하나라도 포함되어야 함
        if (categoryInfo.any_of) {
            const anyOfKeywords = categoryInfo.any_of.map(kw => kw.toLowerCase());
            const hasAnyOf = anyOfKeywords.some(anyKw => lowerName.includes(anyKw));
            const hasKeywords = keywords.every(kw => lowerName.includes(kw));
            return hasKeywords && hasAnyOf;
        } else {
            // 모든 키워드가 포함되어야 함
            return keywords.every(kw => lowerName.includes(kw));
        }
    }

    return false;
}

function categorizeActivity(activity) {
    if (!activity) {
        return { category: "알 수 없음", detail: activity };
    }

    const activityLower = activity.toLowerCase();

    // 카테고리 설정이 아직 로드되지 않았거나 로드 실패 시, 원본 활동명을 그대로 사용
    if (!categoryConfig) {
        if (activity.length > 30) {
            return { category: activity.substring(0, 27) + "...", detail: activity };
        }
        return { category: activity, detail: activity };
    }

    // 우선순위별로 정렬하여 확인
    const sortedCategories = Object.entries(categoryConfig)
        .sort((a, b) => ((b[1].priority || 0) - (a[1].priority || 0)));

    for (const [, categoryInfo] of sortedCategories) {
        if (matchesCategory(activity, activityLower, categoryInfo)) {
            return { category: categoryInfo.name, detail: activity };
        }
    }

    // .exe 파일 처리
    if (activityLower.includes(".exe")) {
        const exeName = activity.replace(".exe", "");
        if (exeName.toLowerCase().includes("python")) {
            return { category: "Python", detail: activity };
        } else {
            return { category: exeName, detail: activity };
        }
    }

    // 카테고리에 매칭되지 않는 경우
    if (activity.length > 30) {
        return { category: activity.substring(0, 27) + "...", detail: activity };
    }

    return { category: activity, detail: activity };
}

async function parseAndCategorizeCSV(text) {
    const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    // 카테고리 설정 먼저 로드 (실패해도 계속 진행)
    await loadCategoryConfig();

    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const entry = {};
        let currentValIndex = 0;
        for (const header of headers) {
            if (header === '활동 내용') {
                entry[header] = values.slice(currentValIndex).join(',');
            } else {
                entry[header] = values[currentValIndex];
            }
            currentValIndex++;
        }

        const { category, detail } = categorizeActivity(entry['활동 내용']);
        entry.category = category;
        entry.detail = detail;

        data.push(entry);
    }
    return data;
}


