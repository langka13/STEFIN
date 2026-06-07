export async function isBiometricAvailable() {
  if (!window.PublicKeyCredential) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (e) {
    return false;
  }
}

export async function registerBiometric(username = 'User') {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  const userId = new Uint8Array(16);
  crypto.getRandomValues(userId);

  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'SteFin App', id: window.location.hostname },
      user: { id: userId, name: username, displayName: username },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 }
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'required',
      },
      timeout: 60000,
      attestation: 'none'
    }
  });

  return cred.id;
}

const base64url2base64 = str => str.replace(/-/g, '+').replace(/_/g, '/');

export async function authenticateBiometric(credentialId) {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const options = {
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      userVerification: 'required',
    }
  };

  if (credentialId) {
    try {
      const buffer = Uint8Array.from(atob(base64url2base64(credentialId)), c => c.charCodeAt(0));
      options.publicKey.allowCredentials = [{
        type: 'public-key',
        id: buffer,
        transports: ['internal']
      }];
    } catch(e) {
      console.warn("Invalid credentialId format", e);
    }
  }

  const assertion = await navigator.credentials.get(options);
  return !!assertion;
}
