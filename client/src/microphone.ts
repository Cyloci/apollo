import React from "react";

interface MicrophoneState {
  recording: boolean;
}

const useMicrophone = (blobCallback: (b: Blob) => void) => {
  const audioContext = new AudioContext();

  const [mediaStream, setMediaStream] = React.useState<MediaStream | undefined>(
    undefined
  );
  const [mediaRecorder, setMediaRecorder] = React.useState<
    MediaRecorder | undefined
  >(undefined);
  const [isRecording, setIsRecording] = React.useState(false);

  let chunks: BlobPart[] = [];

  const setupStream = () => {
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then(setMediaStream);
  };
  React.useEffect(setupStream, []);

  const handleDataAvailable = ({ data }: { data: any }) => {
    console.log("data");
    chunks.push(data);
  };

  const handleStop = async () => {
    console.log("stopped");
    const blob = new Blob(chunks, { type: "audio/ogg; codecs=opus" });
    chunks = [];
    blobCallback(blob);
  };

  const getMediaRecorder = () => {
    if (!mediaStream) {
      return;
    }
    const mediaRecorder = new MediaRecorder(mediaStream);
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.onstop = handleStop;
    setMediaRecorder(mediaRecorder);
  };
  React.useEffect(getMediaRecorder, [mediaStream]);

  const toggleRecording = () => {
    if (!mediaRecorder) {
      return;
    }
    if (isRecording) {
      console.log("stop");
      mediaRecorder.stop();
    } else {
      console.log("recording");
      mediaRecorder.start();
    }
    setIsRecording(!isRecording);
  };

  return { toggleRecording, isRecording };
};

export default useMicrophone;
