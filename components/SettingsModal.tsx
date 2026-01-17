import React, { useState, useEffect } from 'react';
import { X, QrCode, Smartphone, Settings as SettingsIcon, Key } from 'lucide-react';
import { generateAdminTOTP } from '../services/totpService';

interface SettingsModalProps {
  onClose: () => void;
  userEmail?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, userEmail }) => {
  const [qrCodeUrl, setQRCodeUrl] = useState<string>('');
  const [adminSecret, setAdminSecret] = useState<string>('');
  const isAdmin = userEmail?.toLowerCase() === 'aggelosmc@gmail.com';

  useEffect(() => {
    const setupQRCode = async () => {
      try {
        const totp = await generateAdminTOTP();
        setQRCodeUrl(totp.qrCodeDataUrl);
        setAdminSecret(totp.secret);
      } catch (err) {
        console.error('Failed to generate QR code:', err);
      }
    };
    if (isAdmin) {
      setupQRCode();
    }
  }, [isAdmin]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">

        <div className="bg-slate-950 border-b border-slate-800 p-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-brand-600/20 text-brand-500 shadow-lg">
              <SettingsIcon size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Settings</h2>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mt-0.5">Account Configuration</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-xl">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">

          {isAdmin ? (
            <>
              <div className="bg-emerald-950/20 border border-emerald-900/30 p-4 rounded-xl">
                <h3 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-2">
                  <QrCode size={16} />
                  Admin Google Authenticator Setup
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Scan this QR code with Google Authenticator app. All users will use this same code for 2FA.
                </p>

                {qrCodeUrl && (
                  <>
                    <div className="bg-white p-4 rounded-lg mb-3">
                      <img src={qrCodeUrl} alt="QR Code" className="w-full" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400 font-semibold">Manual Entry Key:</p>
                      <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                        <code className="text-xs text-emerald-400 font-mono break-all">{adminSecret}</code>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 mt-3">
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          <strong className="text-emerald-400">Setup Instructions:</strong><br />
                          1. Open Google Authenticator app on your phone<br />
                          2. Tap "+" to add a new account<br />
                          3. Scan the QR code above or enter the manual key<br />
                          4. Use the 6-digit code when signing in<br />
                          5. Share this QR code with all team members for setup
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="bg-brand-950/20 border border-brand-900/30 p-4 rounded-xl">
                <h3 className="text-sm font-bold text-brand-400 mb-2 flex items-center gap-2">
                  <Key size={16} />
                  Security Notice
                </h3>
                <p className="text-xs text-slate-400">
                  All users must configure Google Authenticator with the QR code above to sign in.
                  This shared secret enables two-factor authentication for the entire team.
                </p>
              </div>
            </>
          ) : (
            <div className="bg-slate-950/50 border border-slate-800 p-8 rounded-xl text-center">
              <Smartphone className="text-slate-600 mx-auto mb-4" size={48} />
              <h3 className="text-lg font-bold text-white mb-2">User Settings</h3>
              <p className="text-sm text-slate-400">
                Contact your administrator (<strong>aggelosmc@gmail.com</strong>) to access the Google Authenticator QR code for two-factor authentication setup.
              </p>
            </div>
          )}

          <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl">
            <h3 className="text-sm font-bold text-slate-300 mb-2">Account Information</h3>
            <p className="text-xs text-slate-400">Email: <span className="text-white font-mono">{userEmail}</span></p>
          </div>

        </div>

        <div className="bg-slate-950 border-t border-slate-800 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
