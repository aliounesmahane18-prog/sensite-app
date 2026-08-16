"use client";
import { useState, useRef } from "react";

export function useImageUpload() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [showCropper, setShowCropper] = useState(false);

  const openFilePicker = () => fileRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("Image trop lourde (max 10MB)"); return; }
    const url = URL.createObjectURL(file);
    setRawImage(url);
    setShowCropper(true);
    // Reset input pour permettre re-sélection du même fichier
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleCropComplete = (blob: Blob) => {
    setCroppedBlob(blob);
    setPreview(URL.createObjectURL(blob));
    setShowCropper(false);
    setRawImage(null);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setRawImage(null);
  };

  const reset = () => {
    setPreview(null);
    setCroppedBlob(null);
    setRawImage(null);
    setShowCropper(false);
  };

  return {
    fileRef,
    preview,
    croppedBlob,
    showCropper,
    rawImage,
    openFilePicker,
    handleFileChange,
    handleCropComplete,
    handleCropCancel,
    reset,
    setPreview, // pour initialiser avec une image existante
  };
}
