/**
 * password.js — 비밀번호 정책 유틸리티
 *
 * 최소 길이, 복잡성 요구사항, 공통 비밀번호 차단
 */

const COMMON_PASSWORDS = new Set([
  'password', '123456', '12345678', 'qwerty', 'abc123', 'password1',
  'admin123', 'letmein', 'welcome', 'monkey', '1234567890', 'master',
  'dragon', 'login', 'princess', 'football', 'shadow', 'sunshine',
  'trustno1', 'iloveyou', 'batman', 'access', 'hello', 'charlie',
  'donald', '123123', 'password123', 'admin', 'passw0rd', 'p@ssword',
]);

const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false,    // 특수문자는 권장이지만 필수 아님
  blockCommon: true,
};

/**
 * 비밀번호 정책 검증
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePassword(password, policy = PASSWORD_POLICY) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['비밀번호를 입력해주세요.'] };
  }

  if (password.length < policy.minLength) {
    errors.push(`비밀번호는 최소 ${policy.minLength}자 이상이어야 합니다.`);
  }

  if (password.length > policy.maxLength) {
    errors.push(`비밀번호는 ${policy.maxLength}자를 초과할 수 없습니다.`);
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('대문자를 1자 이상 포함해야 합니다.');
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('소문자를 1자 이상 포함해야 합니다.');
  }

  if (policy.requireNumber && !/[0-9]/.test(password)) {
    errors.push('숫자를 1자 이상 포함해야 합니다.');
  }

  if (policy.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('특수문자를 1자 이상 포함해야 합니다.');
  }

  if (policy.blockCommon && COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('너무 흔한 비밀번호입니다. 다른 비밀번호를 사용해주세요.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 비밀번호 강도 점수 (0-100)
 */
function passwordStrength(password) {
  if (!password) return 0;
  let score = 0;

  // 길이 점수 (최대 30)
  score += Math.min(password.length * 3, 30);

  // 다양성 점수
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 20;

  // 연속 문자 감점
  if (/(.)\1{2,}/.test(password)) score -= 10;
  // 순차 문자 감점 (123, abc)
  if (/(?:012|123|234|345|456|567|678|789|abc|bcd|cde|def)/.test(password.toLowerCase())) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

module.exports = { validatePassword, passwordStrength, PASSWORD_POLICY };
