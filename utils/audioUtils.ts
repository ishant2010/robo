import { Blob } from '@google/genai';

export function base64ToFloat32(base64: string): Float32Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Convert Int16 bytes to Float32 [-1.0, 1.0]
  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768.0;
  }
  return float32Array;
}

export function float32ToPCM16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16;
}

export function createBlob(data: Float32Array): Blob {
  const int16 = float32ToPCM16(data);
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  
  return {
    data: base64,
    mimeType: 'audio/pcm;rate=16000',
  };
}

export async function decodeAudioData(
  base64String: string,
  ctx: AudioContext,
  sampleRate: number = 24000
): Promise<AudioBuffer> {
  // Base64 to Int16 PCM
  const binaryString = atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const int16Data = new Int16Array(bytes.buffer);
  
  // Create AudioBuffer
  const buffer = ctx.createBuffer(1, int16Data.length, sampleRate);
  const channelData = buffer.getChannelData(0);
  
  for (let i = 0; i < int16Data.length; i++) {
    channelData[i] = int16Data[i] / 32768.0;
  }
  
  return buffer;
}