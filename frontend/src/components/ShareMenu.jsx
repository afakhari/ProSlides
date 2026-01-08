import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { X, Check, Loader2 } from "lucide-react";
import { apiFetch } from "../utils/apiFetch";


export default function ShareMenu({
  quizId,
  isOpen,
  onClose,
  accessCode,
  onAccessCodeSaved,
}) {

  const [section, setSection] = useState("invite");
  const [code, setCode] = useState(accessCode || "");
  const [initialCode, setInitialCode] = useState(accessCode || "");
  const [qr, setQr] = useState("");
  const [inputError, setInputError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);

  const baseOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://proslides.ir";
  const BASE = `${baseOrigin}/`;


  // Checking the validity of the code
  const validateCode = (input) => {
    if (!input) {
      return "";
    }
    if (input.length < 5) {
      return "The code must be at least 5 characters.";
    }
    if (input.length > 12) {
      return "The code must be a maximum of 12 characters.";
    }
    if (!/^[A-Za-z0-9]*$/.test(input)) {
      return "Only English letters and numbers are allowed.";
    }
    return "";
  };


  // Save code in the backend
  const saveAccessCode = async () => {
    if (!code || inputError || code.length < 5) return false;

    setIsSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const response = await apiFetch(`/quizzes/${quizId}/`, {
        method: "PATCH",
        json: {
          access_code: code,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = formatSaveError(errorData);

        setSaveError(`${errorMessage}`);
        return false;
      }

      const data = await response.json();
      setSaveSuccess(true);
      const updatedCode = data?.access_code || code;
      setInitialCode(updatedCode);
      if (onAccessCodeSaved) {
        onAccessCodeSaved(updatedCode);
      }

      // Delete success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);

      return true;
    } catch (error) {
      console.error('Error saving access code:', error);
      setSaveError(error.message || 'Failed to save access code');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const formatSaveError = (errorData) => {
    if (!errorData) return "Unable to save access code. Please try again.";
    if (typeof errorData === "string") return errorData;
    if (errorData.access_code) {
      const message = Array.isArray(errorData.access_code)
        ? errorData.access_code.join(" ")
        : errorData.access_code;
      if (String(message).toLowerCase().includes("already")) {
        return "This access code is already in use. Try a different one.";
      }
      return message;
    }
    if (errorData.detail) return errorData.detail;
    const firstValue = Object.values(errorData)[0];
    return firstValue || "Unable to save access code. Please try again.";
  };

  const hasChanges = code !== initialCode;

  const handleSave = async () => {
    if (!isCodeValid || isSaving || !hasChanges) return;
    if (initialCode && !confirmingSave) {
      setConfirmingSave(true);
      return;
    }
    const saved = await saveAccessCode();
    if (saved) {
      setConfirmingSave(false);
    }
  };

  const handleConfirmSave = async () => {
    const saved = await saveAccessCode();
    if (saved) {
      setConfirmingSave(false);
    }
  };

  const handleCancelConfirm = () => {
    setConfirmingSave(false);
  };

  const isCodeValid = code.length >= 5 && !inputError;

  const handleCodeChange = (nextCode) => {
    setCode(nextCode);
    setInputError(validateCode(nextCode));
    setSaveError("");
    setSaveSuccess(false);
    setConfirmingSave(false);
  };


  // Update code when accessCode prop changes
  useEffect(() => {
    if (accessCode) {
      setCode(accessCode);
      setInitialCode(accessCode);
      setInputError(validateCode(accessCode));
      setSaveError("");
      setSaveSuccess(false);
      setConfirmingSave(false);
    } else {
      setCode("");
      setInitialCode("");
      setInputError("");
      setSaveError("");
      setSaveSuccess(false);
      setConfirmingSave(false);
    }
  }, [accessCode]);


  // Generate QR Code
  useEffect(() => {
    if (!code || inputError || code.length < 5) {
      setQr("");
      return;
    }

    const full = BASE + code;
    QRCode.toDataURL(full, { margin: 2 })
      .then((url) => setQr(url))
      .catch((err) => console.error(err));
  }, [BASE, code, inputError]);


  if (!isOpen) return null;


  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
        <div className="bg-white w-[90vw] max-w-[900px] max-h-[90vh] h-auto md:h-[500px] rounded-2xl shadow-xl flex flex-col md:flex-row overflow-hidden relative">
          <button
            onClick={onClose}
            className="absolute right-5 top-5 text-gray-500 hover:text-black"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="w-full md:w-1/3 bg-pink-50 border-b md:border-b-0 md:border-r p-5 flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-pink-700 mb-2">
              Share options
            </h2>
            <MenuItem
              label="Invite audience"
              active={section === "invite"}
              onClick={() => setSection("invite")}
            />
          </div>

          <div className="w-full md:w-2/3 p-6 overflow-y-auto">
            {section === "invite" && (
              <InviteAudienceUI
                BASE={BASE}
                code={code}
                onCodeChange={handleCodeChange}
                qr={qr}
                inputError={inputError}
                onSave={handleSave}
                onConfirmSave={handleConfirmSave}
                onCancelConfirm={handleCancelConfirm}
                onClose={onClose}
                isSaving={isSaving}
                saveError={saveError}
                saveSuccess={saveSuccess}
                hasChanges={hasChanges}
                confirmingSave={confirmingSave}
                isCodeValid={isCodeValid}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}


function MenuItem({ label, active, onClick }) {
  return (
    <button
      className={`w-full text-left px-3 py-2 rounded-lg font-medium transition
        ${
          active
            ? "bg-pink-200 text-pink-700"
            : "hover:bg-pink-100 text-gray-700"
        }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}


function InviteAudienceUI({
  BASE,
  code,
  onCodeChange,
  qr,
  inputError,
  onSave,
  onConfirmSave,
  onCancelConfirm,
  onClose,
  isSaving,
  saveError,
  saveSuccess,
  hasChanges,
  confirmingSave,
  isCodeValid
}) {

  const handleCodeChange = (e) => {
    const newCode = e.target.value.replace(/\s+/g, "");
    onCodeChange(newCode);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSave();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };


  // Checking the validity of the code to enable/disable the save button
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-3">
        Invite audience
      </h2>

      <p className="text-gray-600 text-sm">Audience can join at :</p>

      {/* --------------- Code Entry Section --------------- */}
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
        <span className="text-gray-500">{BASE}</span>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <input
            className={`flex-1 min-w-[160px] border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 ${
              inputError ? "border-pink-500" : "border-gray-300"
            }`}
            placeholder="room1"
            value={code}
            onChange={handleCodeChange}
            onKeyDown={handleKeyDown}
            maxLength={12}
            aria-describedby="access-code-help access-code-error"
          />
          <button
            onClick={onSave}
            disabled={!isCodeValid || !hasChanges || isSaving}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              !isCodeValid || !hasChanges || isSaving
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-pink-600 text-white hover:bg-pink-700"
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save
              </>
            )}
          </button>
        </div>
      </div>

      <p id="access-code-help" className="text-xs text-gray-500 mt-2">
        5-12 characters, letters and numbers only.
      </p>


      {/* --------------- Display Validation Error Message --------------- */}
      {inputError && (
        <p id="access-code-error" className="text-red-500 text-sm mt-3">
          {inputError}
        </p>
      )}

      {/* --------------- Display A Success Or Error Message When Saving --------------- */}
      {saveSuccess && (
        <p className="text-green-600 text-sm mt-3">
          Access code saved successfully!
        </p>
      )}

      {saveError && (
        <p className="text-red-500 text-sm mt-3">Error: {saveError}</p>
      )}

      {confirmingSave && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Changing the access code will disable the previous link. Do you want
          to continue?
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onConfirmSave}
              disabled={isSaving}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed"
            >
              Confirm and save
            </button>
            <button
              type="button"
              onClick={onCancelConfirm}
              className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* --------------- Display QR Code Only If The Code Is Valid And There Are No Errors --------------- */}
      {qr && !inputError && code.length >= 5 && (
        <div className="mt-6 flex flex-col items-center">
          <p className="text-sm text-gray-600 mb-2">scan QR or</p>
          <img
            src={qr}
            alt="qr"
            className="w-44 h-44 border rounded-xl shadow"
          />

          <a
            download="qr.png"
            href={qr}
            className="mt-3 px-4 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-sm shadow transition"
          >
            Download QR
          </a>
        </div>
      )}
    </div>
  );
}
