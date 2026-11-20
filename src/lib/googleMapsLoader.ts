"use client";

let googleMapsPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  // 1. If already loaded, resolve immediately
  if ((window as any).google && (window as any).google.maps) {
    return Promise.resolve();
  }

  // 2. Check if a script tag already exists in document.head
  const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
  if (existingScript) {
    return new Promise((resolve) => {
      if ((window as any).google && (window as any).google.maps) {
        resolve();
        return;
      }
      existingScript.addEventListener("load", () => resolve());
    });
  }

  // 3. Create a single singleton promise for in-flight loading
  if (!googleMapsPromise) {
    googleMapsPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBsWnNq9bnzB8UATSXH0Hxiv6rDbQirD-Y&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    });
  }

  return googleMapsPromise;
}
