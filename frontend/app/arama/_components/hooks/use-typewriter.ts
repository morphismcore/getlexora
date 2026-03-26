"use client";

import { useState, useEffect } from "react";

/**
 * Typewriter effect hook that cycles through an array of phrases,
 * typing them out character by character and then deleting.
 */
export function useTypewriter(
  phrases: readonly string[] | string[],
  typingSpeed = 60,
  pauseDuration = 2200,
  deletingSpeed = 30,
): string {
  const [text, setText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentPhrase = phrases[phraseIndex];

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          setText(currentPhrase.slice(0, text.length + 1));
          if (text.length + 1 === currentPhrase.length) {
            setTimeout(() => setIsDeleting(true), pauseDuration);
          }
        } else {
          setText(currentPhrase.slice(0, text.length - 1));
          if (text.length === 0) {
            setIsDeleting(false);
            setPhraseIndex((prev) => (prev + 1) % phrases.length);
          }
        }
      },
      isDeleting ? deletingSpeed : typingSpeed,
    );

    return () => clearTimeout(timeout);
  }, [text, phraseIndex, isDeleting, phrases, typingSpeed, pauseDuration, deletingSpeed]);

  return text;
}
