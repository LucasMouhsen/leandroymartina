export const INVITATION_QUERY_PARAM = 'invitacion'

export function getStoredInvitationToken() {
  return null
}

export function rememberInvitationToken(token) {
  // The explicit URL parameter is the sole invitation context.
  return token
}

export function buildFeaturePath(path, token) {
  if (!token) {
    return path
  }

  return `${path}?${INVITATION_QUERY_PARAM}=${encodeURIComponent(token)}`
}

export function buildInvitationPath(token) {
  return token ? `/invitacion/${encodeURIComponent(token)}` : '/'
}
