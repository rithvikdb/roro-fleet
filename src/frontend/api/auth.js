import { getJson, postJson } from './client';

export async function getSessionUser() {
  return getJson('/api/auth/me');
}

export async function login(email, password) {
  return postJson('/api/auth/login', { email, password });
}

export async function register(email, password, fullName) {
  return postJson('/api/auth/register', { email, password, full_name: fullName });
}

export async function logout() {
  return postJson('/api/auth/logout', {});
}
