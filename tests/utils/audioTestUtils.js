/**
 * Utility functions for generating test audio and analyzing frequencies
 * Uses Web Audio API to create known test tones for validation
 *
 * Adapted from babylonjs-sound-testing repository for Flock XR
 */

/**
 * Generate a test tone using Web Audio API
 * @param {AudioContext} audioContext - The Web Audio context
 * @param {number} frequency - Frequency in Hz (e.g., 440 for A4)
 * @param {number} duration - Duration in seconds
 * @param {number} sampleRate - Sample rate (default: 44100)
 * @returns {AudioBuffer} - Generated audio buffer
 */
export function generateTestTone(audioContext, frequency, duration, sampleRate = 44100) {
  const numSamples = duration * sampleRate;
  const audioBuffer = audioContext.createBuffer(1, numSamples, sampleRate);
  const channelData = audioBuffer.getChannelData(0);

  for (let i = 0; i < numSamples; i++) {
    // Generate sine wave: amplitude * sin(2π * frequency * time)
    channelData[i] = Math.sin(2 * Math.PI * frequency * (i / sampleRate));
  }

  return audioBuffer;
}

/**
 * Generate silence (for testing silence detection)
 * @param {AudioContext} audioContext - The Web Audio context
 * @param {number} duration - Duration in seconds
 * @param {number} sampleRate - Sample rate (default: 44100)
 * @returns {AudioBuffer} - Silent audio buffer
 */
export function generateSilence(audioContext, duration, sampleRate = 44100) {
  const numSamples = duration * sampleRate;
  const audioBuffer = audioContext.createBuffer(1, numSamples, sampleRate);
  // channelData is already initialized to zeros (silence)
  return audioBuffer;
}

/**
 * Create an audio blob from an AudioBuffer
 * @param {AudioBuffer} audioBuffer - The audio buffer to convert
 * @returns {Promise<Blob>} - WAV file blob
 */
export async function audioBufferToBlob(audioBuffer) {
  const numOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numOfChannels * 2;

  // Handle zero-length buffers
  if (audioBuffer.length === 0) {
    // Return minimal valid WAV with just header
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    let pos = 0;

    const writeString = (str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(pos++, str.charCodeAt(i));
      }
    };

    writeString('RIFF');
    view.setUint32(pos, 36, true); pos += 4; // File size - 8
    writeString('WAVE');
    writeString('fmt ');
    view.setUint32(pos, 16, true); pos += 4;
    view.setUint16(pos, 1, true); pos += 2; // PCM
    view.setUint16(pos, numOfChannels, true); pos += 2;
    view.setUint32(pos, audioBuffer.sampleRate, true); pos += 4;
    view.setUint32(pos, audioBuffer.sampleRate * 2 * numOfChannels, true); pos += 4;
    view.setUint16(pos, numOfChannels * 2, true); pos += 2;
    view.setUint16(pos, 16, true); pos += 2;
    writeString('data');
    view.setUint32(pos, 0, true); // Zero data length

    return new Blob([buffer], { type: 'audio/wav' });
  }

  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);
  const channels = [];
  let offset = 0;
  let pos = 0;

  // Write WAV header
  const writeString = (str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(pos++, str.charCodeAt(i));
    }
  };

  writeString('RIFF');
  view.setUint32(pos, 36 + length, true); pos += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(pos, 16, true); pos += 4; // fmt chunk size
  view.setUint16(pos, 1, true); pos += 2; // audio format (1 = PCM)
  view.setUint16(pos, numOfChannels, true); pos += 2;
  view.setUint32(pos, audioBuffer.sampleRate, true); pos += 4;
  view.setUint32(pos, audioBuffer.sampleRate * 2 * numOfChannels, true); pos += 4;
  view.setUint16(pos, numOfChannels * 2, true); pos += 2;
  view.setUint16(pos, 16, true); pos += 2;
  writeString('data');
  view.setUint32(pos, length, true); pos += 4;

  // Write audio data
  for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }

  while (pos < buffer.byteLength) {
    for (let i = 0; i < numOfChannels; i++) {
      const sample = Math.max(-1, Math.min(1, channels[i][offset]));
      view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Find the dominant frequency in frequency data
 * @param {Float32Array} frequencyData - Frequency data from AnalyserNode
 * @param {number} sampleRate - Sample rate of the audio
 * @returns {number} - Dominant frequency in Hz
 */
export function findDominantFrequency(frequencyData, sampleRate) {
  let maxValue = -Infinity;
  let maxIndex = 0;

  for (let i = 0; i < frequencyData.length; i++) {
    if (frequencyData[i] > maxValue) {
      maxValue = frequencyData[i];
      maxIndex = i;
    }
  }

  // Convert bin index to frequency
  // frequency = (index * sampleRate) / (2 * bufferLength)
  const frequency = (maxIndex * sampleRate) / (2 * frequencyData.length);

  return frequency;
}

/**
 * Check if audio is silent (all frequencies below threshold)
 * @param {Float32Array} frequencyData - Frequency data from AnalyserNode
 * @param {number} threshold - dB threshold (default: -100)
 * @returns {boolean} - True if silent
 */
export function isSilent(frequencyData, threshold = -100) {
  for (let i = 0; i < frequencyData.length; i++) {
    if (frequencyData[i] > threshold) {
      return false;
    }
  }
  return true;
}

/**
 * Calculate RMS (Root Mean Square) of frequency data
 * Useful for measuring overall audio energy
 * Note: For dB values, this converts to linear scale first
 * @param {Float32Array} frequencyData - Frequency data from AnalyserNode (in dB)
 * @returns {number} - RMS value (non-negative)
 */
export function calculateRMS(frequencyData) {
  let sum = 0;
  let count = 0;

  for (let i = 0; i < frequencyData.length; i++) {
    const value = frequencyData[i];

    // Skip -Infinity values (complete silence)
    if (isFinite(value)) {
      // Convert from dB to linear scale for RMS calculation
      const linearValue = Math.pow(10, value / 20);
      sum += linearValue * linearValue;
      count++;
    }
  }

  if (count === 0) {
    return 0;
  }

  return Math.sqrt(sum / count);
}

/**
 * Check if a specific frequency is present in the audio
 * @param {Float32Array} frequencyData - Frequency data from AnalyserNode
 * @param {number} targetFrequency - Target frequency in Hz
 * @param {number} sampleRate - Sample rate
 * @param {number} tolerance - Tolerance in Hz (default: 50)
 * @param {number} threshold - Minimum magnitude threshold (default: -50)
 * @returns {boolean} - True if frequency is present
 */
export function hasFrequency(frequencyData, targetFrequency, sampleRate, tolerance = 50, threshold = -50) {
  const binWidth = sampleRate / (2 * frequencyData.length);
  const targetBin = Math.floor(targetFrequency / binWidth);
  const toleranceBins = Math.ceil(tolerance / binWidth);

  for (let i = Math.max(0, targetBin - toleranceBins);
       i <= Math.min(frequencyData.length - 1, targetBin + toleranceBins);
       i++) {
    if (frequencyData[i] > threshold) {
      return true;
    }
  }

  return false;
}

/**
 * Detect clipping in audio buffer (samples near maximum amplitude)
 * @param {AudioBuffer} audioBuffer - Audio buffer to analyze
 * @param {number} threshold - Amplitude threshold for clipping detection (default: 0.99)
 * @returns {Object} - { hasClipping: boolean, clippedCount: number, totalSamples: number, clippingPercentage: number }
 */
export function detectClipping(audioBuffer, threshold = 0.99) {
  let clippedCount = 0;
  let totalSamples = 0;

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    totalSamples += channelData.length;

    for (let i = 0; i < channelData.length; i++) {
      if (Math.abs(channelData[i]) >= threshold) {
        clippedCount++;
      }
    }
  }

  return {
    hasClipping: clippedCount > 0,
    clippedCount: clippedCount,
    totalSamples: totalSamples,
    clippingPercentage: totalSamples > 0 ? (clippedCount / totalSamples) * 100 : 0
  };
}

/**
 * Calculate Peak Amplitude of an audio buffer
 * @param {AudioBuffer} audioBuffer - Audio buffer to analyze
 * @returns {number} - Peak amplitude (0.0 to 1.0)
 */
export function calculatePeakAmplitude(audioBuffer) {
  let peak = 0;

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < channelData.length; i++) {
      const absSample = Math.abs(channelData[i]);
      if (absSample > peak) {
        peak = absSample;
      }
    }
  }

  return peak;
}

/**
 * Calculate RMS from time-domain audio buffer (alternative to frequency-domain RMS)
 * @param {AudioBuffer} audioBuffer - Audio buffer to analyze
 * @returns {number} - RMS value
 */
export function calculateRMSFromBuffer(audioBuffer) {
  let sumOfSquares = 0;
  let totalSamples = 0;

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    totalSamples += channelData.length;

    for (let i = 0; i < channelData.length; i++) {
      sumOfSquares += channelData[i] * channelData[i];
    }
  }

  return totalSamples > 0 ? Math.sqrt(sumOfSquares / totalSamples) : 0;
}
