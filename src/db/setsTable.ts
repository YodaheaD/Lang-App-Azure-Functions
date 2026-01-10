import SetTableLike from "./setsTableLike";

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

export const setsTable = new SetTableLike<any>("sets");
