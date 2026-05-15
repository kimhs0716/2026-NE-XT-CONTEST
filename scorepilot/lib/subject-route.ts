export function encodeSubjectSegment(subject: string): string {
  return encodeURIComponent(subject).replace(/%/g, "~");
}

export function decodeSubjectSegment(segment: string): string {
  return decodeURIComponent(segment.replace(/~/g, "%"));
}
