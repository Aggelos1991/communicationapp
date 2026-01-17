import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';

interface TOTPSecret {
  secret: string;
  qrCodeDataUrl: string;
  otpauthUrl: string;
}

// Admin secret - in production, this should be stored securely in environment variables
const ADMIN_SECRET = 'JBSWY3DPEHPK3PXP'; // Base32 encoded secret

/**
 * Generate a new TOTP secret and QR code for admin setup
 * This should only be called once to set up the admin's Google Authenticator
 */
export const generateAdminTOTP = async (): Promise<TOTPSecret> => {
  const totp = new OTPAuth.TOTP({
    issuer: 'FinComms',
    label: 'Admin',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: ADMIN_SECRET,
  });

  const otpauthUrl = totp.toString();
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return {
    secret: ADMIN_SECRET,
    qrCodeDataUrl,
    otpauthUrl,
  };
};

/**
 * Verify a TOTP token against the admin secret
 */
export const verifyTOTP = (token: string): boolean => {
  try {
    const totp = new OTPAuth.TOTP({
      issuer: 'FinComms',
      label: 'Admin',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: ADMIN_SECRET,
    });

    // Verify with a window of ±1 period (30 seconds) to account for clock drift
    const delta = totp.validate({ token, window: 1 });

    // Returns null if invalid, or a number indicating the time step difference
    return delta !== null;
  } catch (error) {
    console.error('TOTP verification error:', error);
    return false;
  }
};

/**
 * Get the current TOTP token (for testing purposes only)
 */
export const getCurrentToken = (): string => {
  const totp = new OTPAuth.TOTP({
    issuer: 'FinComms',
    label: 'Admin',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: ADMIN_SECRET,
  });

  return totp.generate();
};
