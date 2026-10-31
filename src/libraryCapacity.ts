// Application business failure, separate from single-card parsing and IDB errors.
// This is an in-memory error only; no v1 record or backup field is added.
export class LibraryCapacityError extends Error {
  constructor(
    public readonly code: "library-count" | "library-bytes",
    public readonly limit: number,
  ) {
    super(
      code === "library-count"
        ? `知识库最多 ${limit} 张卡片；原数据保持不变`
        : `知识库超过 ${limit / 1024 / 1024} MB 可恢复容量；原数据保持不变`,
    );
    this.name = "LibraryCapacityError";
  }
}
