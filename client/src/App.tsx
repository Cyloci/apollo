import React, { useState, useEffect } from "react";
import useMicrophone from "./microphone";
import getBlobDuration from "get-blob-duration";
const util = require("audio-buffer-utils");

const BPM = 100;
const NUM_BEATS_IN_LOOP = 16;
const MAX_TRACK_WIDTH_PIXELS = 800;
const LOOP_DURATION_SECONDS = (NUM_BEATS_IN_LOOP / BPM) * 60;

interface Track {
  x: number;
  width: number;
  dragging: boolean;
  originX: number;
  buffer: AudioBuffer;
}

interface State {
  time: number;
  isPlaying: boolean;
  isRecording: boolean;
  tracks: Track[];
  audioBufferSources: AudioBufferSourceNode[];
}

const App = () => {
  const [state, setState] = React.useState<State>({
    time: 0,
    isPlaying: false,
    isRecording: false,
    tracks: [],
    audioBufferSources: [],
  });

  const audioContext = new AudioContext();

  const [ws] = useState(new WebSocket("ws://localhost:8080"));

  ws.onmessage = (event: MessageEvent) => {
    console.log("recieved", event.data);
    const blob = event.data as Blob;
    addBlob(blob);
  };

  const broadcastBlob = async (blob: Blob) => {
    ws.send(blob);
    addBlob(blob);
  };

  const addBlob = async (blob: Blob) => {
    const duration = await getBlobDuration(blob);
    const buffer = await audioContext.decodeAudioData(await blob.arrayBuffer());
    setState((state) => ({
      ...state,
      tracks: [
        ...state.tracks,
        {
          x: 0,
          width: (duration / LOOP_DURATION_SECONDS) * MAX_TRACK_WIDTH_PIXELS,
          dragging: false,
          originX: 0,
          buffer,
        },
      ],
    }));
  };

  useEffect(() => {
    return () => {
      ws.close();
    };
  }, [ws]);

  const { toggleRecording, isRecording } = useMicrophone(broadcastBlob);

  const onMouseDownTrack = (index: number) => (
    e: React.MouseEvent<SVGRectElement>
  ) => {
    e.persist();
    const { left } = (e.target as HTMLElement).getBoundingClientRect();
    setState((state) => ({
      ...state,
      tracks: state.tracks.map((t, i) =>
        i !== index
          ? t
          : {
              ...t,
              dragging: true,
              originX: e.clientX - left,
            }
      ),
    }));
  };

  const onMouseMove = (index: number) => (
    e: React.MouseEvent<SVGRectElement>
  ) => {
    e.persist();
    const { left } = (e.target as HTMLElement).getBoundingClientRect();
    setState((state) => ({
      ...state,
      tracks: state.tracks.map((t, i) =>
        !t.dragging || i !== index
          ? t
          : {
              ...t,
              x: Math.min(
                Math.max(0, t.x - (t.originX - (e.clientX - left))),
                MAX_TRACK_WIDTH_PIXELS - t.width
              ),
            }
      ),
    }));
  };

  const onMouseUp = () => {
    setState((state) => ({
      ...state,
      tracks: state.tracks.map((t) => ({
        ...t,
        dragging: false,
        originX: 0,
      })),
    }));
  };

  const pauseAll = () => {
    state.audioBufferSources.forEach((source) => source.stop());
  };
  const togglePlay = () => {
    if (state.isPlaying) {
      console.log("pause");
      pauseAll();
    } else {
      console.log("play");
      pauseAll();
      state.tracks.forEach(({ buffer: ab }) => {
        const source = audioContext.createBufferSource();
        source.loop = true;
        source.buffer = ab;
        source.connect(audioContext.destination);
        source.start(0);
        setState((state) => ({
          ...state,
          audioBufferSources: [...state.audioBufferSources, source],
        }));
      });
    }
    setState((state) => ({ ...state, isPlaying: !state.isPlaying }));
  };

  const onDeleteTrack = (i: number) => () => {
    state.audioBufferSources[i].stop();
    setState((state) => ({
      ...state,
      tracks: state.tracks.slice(0, i).concat(state.tracks.slice(i + 1)),
    }));
  };

  return (
    <div>
      <div>
        <button onClick={toggleRecording}>
          {isRecording ? "Stop Recording" : "Record"}
        </button>
        <button onClick={togglePlay}>
          {state.isPlaying ? "Pause" : "Play"}
        </button>
      </div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 1000 1000`}
        style={{ background: "#111" }}
        onMouseUp={onMouseUp}
      >
        <defs>
          <linearGradient id="trackGradient" gradientTransform="rotate(90)">
            <stop offset="5%" stopColor="gold" />
            <stop offset="95%" stopColor="red" />
          </linearGradient>
          <pattern
            id="smallGrid"
            width="50"
            height="50"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 50 0 L 0 0 0 50"
              fill="none"
              stroke="gray"
              strokeWidth="0.5"
            />
          </pattern>
          <pattern
            id="grid"
            width="200"
            height="50"
            patternUnits="userSpaceOnUse"
          >
            <rect width="200" height="200" fill="url(#smallGrid)" />
            <path
              d="M 200 0 L 0 0 0 50"
              fill="none"
              stroke="gray"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width={MAX_TRACK_WIDTH_PIXELS} height="100%" fill="url(#grid)" />
        <g className="tracks">
          {state.tracks.map((track, i) => {
            return (
              <g key={i}>
                <rect
                  x={track.x}
                  y={`${50 * i}`}
                  width={track.width}
                  height="50"
                  fill="url('#trackGradient')"
                  rx="5"
                  onMouseDown={onMouseDownTrack(i)}
                  onMouseMove={onMouseMove(i)}
                />
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};

export default App;
