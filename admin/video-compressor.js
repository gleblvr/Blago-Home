'use strict';

window.BLAGO_VIDEO = (() => {
  const MAX_INPUT_BYTES = 500 * 1024 * 1024;
  const MAX_OUTPUT_BYTES = 50 * 1024 * 1024;
  const MAX_DURATION_SECONDS = 180;
  const VIDEO_BITS_PER_SECOND = 1_800_000;
  const AUDIO_BITS_PER_SECOND = 96_000;

  function supportedMimeType() {
    const candidates = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
  }

  function even(value) {
    const rounded = Math.max(2, Math.round(value));
    return rounded % 2 ? rounded - 1 : rounded;
  }

  function targetSize(width, height) {
    const longEdge = Math.max(width, height);
    const shortEdge = Math.min(width, height);
    const scale = Math.min(1, 1280 / longEdge, 720 / shortEdge);
    return {width: even(width * scale), height: even(height * scale)};
  }

  function loadVideo(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);
      video.preload = 'metadata';
      video.playsInline = true;
      video.onloadedmetadata = () => resolve({video, url});
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Браузер не смог прочитать выбранное видео.'));
      };
      video.src = url;
    });
  }

  async function compress(file, onProgress = () => {}) {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      throw new Error('Этот браузер не поддерживает сжатие видео. Откройте админку в актуальном Chrome или Edge на компьютере.');
    }
    if (!file?.type?.startsWith('video/')) throw new Error('Выберите видеофайл.');
    if (file.size > MAX_INPUT_BYTES) throw new Error('Исходный файл не должен превышать 500 МБ.');

    const mimeType = supportedMimeType();
    if (!mimeType) throw new Error('Браузер не поддерживает подходящий формат записи видео.');

    const {video, url} = await loadVideo(file);
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      URL.revokeObjectURL(url);
      throw new Error('Не удалось определить продолжительность видео.');
    }
    if (video.duration > MAX_DURATION_SECONDS) {
      URL.revokeObjectURL(url);
      throw new Error('Максимальная продолжительность видео — 3 минуты.');
    }

    const size = targetSize(video.videoWidth, video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d', {alpha: false});
    const stream = canvas.captureStream(30);
    let audioContext;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioContext = new AudioContextClass();
        const source = audioContext.createMediaElementSource(video);
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);
        destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
        await audioContext.resume();
      }

      const chunks = [];
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND
      });
      recorder.ondataavailable = event => {
        if (event.data.size) chunks.push(event.data);
      };

      const finished = new Promise((resolve, reject) => {
        recorder.onerror = () => reject(new Error('Не удалось перекодировать видео.'));
        recorder.onstop = resolve;
      });

      let drawing = true;
      const draw = () => {
        if (!drawing) return;
        context.drawImage(video, 0, 0, size.width, size.height);
        onProgress(Math.min(99, Math.round((video.currentTime / video.duration) * 100)));
        requestAnimationFrame(draw);
      };

      video.currentTime = 0;
      recorder.start(1000);
      draw();
      await video.play();
      await new Promise((resolve, reject) => {
        video.onended = resolve;
        video.onerror = () => reject(new Error('Ошибка при обработке видео.'));
      });
      drawing = false;
      recorder.stop();
      await finished;

      const outputType = mimeType.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';
      const extension = outputType === 'video/mp4' ? 'mp4' : 'webm';
      const blob = new Blob(chunks, {type: outputType});
      if (!blob.size) throw new Error('После сжатия получился пустой файл.');
      if (blob.size > MAX_OUTPUT_BYTES) throw new Error('После сжатия видео всё ещё превышает 50 МБ. Укоротите ролик.');

      onProgress(100);
      return {
        file: new File([blob], `property-video.${extension}`, {type: outputType}),
        durationSeconds: Number(video.duration.toFixed(2)),
        width: size.width,
        height: size.height
      };
    } finally {
      video.pause();
      stream.getTracks().forEach(track => track.stop());
      if (audioContext) await audioContext.close().catch(() => {});
      URL.revokeObjectURL(url);
    }
  }

  return {
    compress,
    limits: {
      maxInputBytes: MAX_INPUT_BYTES,
      maxOutputBytes: MAX_OUTPUT_BYTES,
      maxDurationSeconds: MAX_DURATION_SECONDS
    }
  };
})();
