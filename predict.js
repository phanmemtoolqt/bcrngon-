// shared/predict.js

/**
 * Dự đoán Baccarat dựa trên chuỗi kết quả
 * @param {string[]} results - Mảng các ký tự P/B/T
 * @returns {object} Kết quả dự đoán
 */
function predictBaccarat(results) {
    if (!results || results.length === 0) {
        return {
            val: null,
            conf: 0,
            prob_b: 0.5,
            prob_p: 0.5,
            streak: 0,
            algos: 'Không đủ dữ liệu'
        };
    }

    const clean = results.filter(r => r === 'P' || r === 'B' || r === 'T');
    if (clean.length === 0) {
        return {
            val: null,
            conf: 0,
            prob_b: 0.5,
            prob_p: 0.5,
            streak: 0,
            algos: 'Không có dữ liệu P/B/T'
        };
    }

    const last10 = clean.slice(-10);
    const last20 = clean.slice(-20);
    const lastResult = clean[clean.length - 1];

    // Đếm tổng
    const countB = clean.filter(r => r === 'B').length;
    const countP = clean.filter(r => r === 'P').length;
    const countT = clean.filter(r => r === 'T').length;
    const total = clean.length;

    // Xác suất cơ bản
    let probB = countB / total || 0.5;
    let probP = countP / total || 0.5;

    // Phát hiện streak (cầu bệt)
    let streak = 1;
    for (let i = clean.length - 2; i >= 0; i--) {
        if (clean[i] === lastResult) streak++;
        else break;
    }

    // Phát hiện cầu 1-1
    let isAlternating = false;
    if (last10.length >= 4) {
        const last4 = last10.slice(-4);
        if ((last4[0] !== last4[1] && last4[1] !== last4[2] && last4[2] !== last4[3]) &&
            (last4[0] === last4[2] || last4[1] === last4[3])) {
            isAlternating = true;
        }
    }

    // Dự đoán
    let prediction = null;
    let confidence = 50;
    let algos = [];

    // Logic cầu bệt
    if (streak >= 3) {
        prediction = lastResult;
        confidence = Math.min(85, 50 + streak * 8);
        algos.push(`Cầu bệt ${lastResult} (${streak} lần)`);
    }

    // Logic cầu 1-1
    if (isAlternating && !prediction) {
        prediction = lastResult === 'B' ? 'P' : 'B';
        confidence = 65;
        algos.push('Cầu 1-1');
    }

    // Logic nghiêng
    if (!prediction) {
        const last10B = last10.filter(r => r === 'B').length;
        const last10P = last10.filter(r => r === 'P').length;

        if (last10B >= 7) {
            prediction = 'B';
            confidence = 60;
            algos.push('Nghiêng Banker mạnh');
        } else if (last10P >= 7) {
            prediction = 'P';
            confidence = 60;
            algos.push('Nghiêng Player mạnh');
        } else if (last10B > last10P) {
            prediction = 'B';
            confidence = 50;
            algos.push('Nghiêng Banker nhẹ');
        } else if (last10P > last10B) {
            prediction = 'P';
            confidence = 50;
            algos.push('Nghiêng Player nhẹ');
        } else {
            // Mặc định theo xác suất
            prediction = probB > probP ? 'B' : 'P';
            confidence = 45;
            algos.push('Xác suất thống kê');
        }
    }

    // Giới hạn confidence
    confidence = Math.max(30, Math.min(95, confidence));

    if (algos.length === 0) algos.push('Phân tích cơ bản');

    return {
        val: prediction,
        conf: confidence,
        prob_b: probB,
        prob_p: probP,
        streak: streak,
        algos: algos.join(' + ')
    };
}

/**
 * Format response cho Baccarat
 * @param {object} data - Dữ liệu thô
 * @returns {object} Dữ liệu đã format
 */
function formatBaccaratResponse(data) {
    if (!data) return { success: false, message: 'Không có dữ liệu' };

    return {
        success: true,
        table: data.table || '?',
        result: data.result || '',
        prediction: data.prediction || null,
        confidence: data.confidence || 0,
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    predictBaccarat,
    formatBaccaratResponse
};
