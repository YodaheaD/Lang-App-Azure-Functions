import TableLike from "./tablelike";

// export interface journalTypes {
//   partitionKey: string;
//   rowKey: string;
//   folder: string;
//   name: string;
//   images: string;
//   startDate: string;
//   endDate: string;
//   tripNumber: number;
// }

export const wordsTable = new TableLike<any>("words");
