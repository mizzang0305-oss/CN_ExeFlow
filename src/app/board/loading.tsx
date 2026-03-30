import { LoadingOverlay } from "@/components";

export default function BoardLoading() {
  return (
    <LoadingOverlay
      useGif
      message="Loading the execution board"
      submessage="Bringing board status, directive activity, and key metrics into focus."
    />
  );
}
