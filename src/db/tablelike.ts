import { TableClient, TableEntity } from "@azure/data-tables";

const connectionString = process.env.AzureWebJobsStorage;

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

export interface LanguageQueryOptions {
  page?: number;
  limit?: number;
  sortForJapanese?: boolean;
}

export default class TableLike<Type extends TableEntity<object>> {
  private client: TableClient;

  constructor(public readonly tableName: string) {
    if (!connectionString) {
      throw new Error("Azure Storage connection string not found");
    }
    this.client = TableClient.fromConnectionString(connectionString, tableName);
  }

  /**
   * Maps language string to partition key
   */
  private mapLanguageToPartitionKey(language: string): string | null {
    switch (language.toLowerCase()) {
      case "japanese":
        return "ja";
      case "spanish":
        return "es";
      default:
        return null;
    }
  }

  /**
   * Retrieves all entities for a given partition key
   */
  private async getEntitiesByPartitionKey(partitionKey: string): Promise<Type[]> {
    const entities: Type[] = [];
    const listResults = this.client.listEntities<Type>({
      queryOptions: { filter: `PartitionKey eq '${partitionKey}'` },
    });

    for await (const entity of listResults) {
      entities.push(entity);
    }

    return entities;
  }

  /**
   * Sorts Japanese entities by type, then by word within each type
   */
  private sortJapaneseEntities(entities: Type[]): Type[] {
    // Group entities by type
    const typeGroups = new Map<string, Type[]>();
    
    for (const entity of entities) {
      const type = (entity as any).type || 'unknown';
      if (!typeGroups.has(type)) {
        typeGroups.set(type, []);
      }
      typeGroups.get(type)!.push(entity);
    }
    
    // Sort each group by word and combine back
    const sortedEntities: Type[] = [];
    
    // Sort the type groups by type name first
    const sortedTypes = Array.from(typeGroups.keys()).sort();
    
    for (const type of sortedTypes) {
      const group = typeGroups.get(type)!;
      // Sort each group by word field
      group.sort((a, b) => {
        const wordA = ((a as any).Word || (a as any).word || '').toString().toLowerCase();
        const wordB = ((b as any).Word || (b as any).word || '').toString().toLowerCase();
        return wordA.localeCompare(wordB);
      });
      // Add the sorted group back to entities
      sortedEntities.push(...group);
    }

    return sortedEntities;
  }

  /**
   * Applies pagination to an array of entities
   */
  private paginateEntities(entities: Type[], page: number, limit: number): Type[] {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    return entities.slice(startIndex, endIndex);
  }

  /**
   * Gets paginated data for a specific language with optional sorting
   */
  public async getDataForLanguage(
    language: string,
    options: LanguageQueryOptions = {}
  ): Promise<PaginatedResult<Type> | { error: string }> {
    const { page = 1, limit = 10, sortForJapanese = false } = options;

    // Validate pagination parameters
    if (page < 1 || limit < 1) {
      return { error: "Page and limit must be positive numbers" };
    }

    // Map language to partition key
    const partitionKey = this.mapLanguageToPartitionKey(language);
    if (!partitionKey) {
      return { error: "Invalid language" };
    }

    try {
      // Get all entities for the partition
      let entities = await this.getEntitiesByPartitionKey(partitionKey);

      // Apply sorting for Japanese if requested
      if (sortForJapanese && language.toLowerCase() === "japanese") {
        entities = this.sortJapaneseEntities(entities);
      }

      // Apply pagination
      const paginatedData = this.paginateEntities(entities, page, limit);

      return {
        data: paginatedData,
        page,
        limit,
        total: entities.length
      };
    } catch (error) {
      return { error: "Failed to retrieve data from storage" };
    }
  }

  /**
   * Gets the total count of entities for a specific language
   */
  public async getCountForLanguage(language: string): Promise<number | { error: string }> {
    // Map language to partition key
    const partitionKey = this.mapLanguageToPartitionKey(language);
    if (!partitionKey) {
      return { error: "Invalid language" };
    }

    try {
      const entities = await this.getEntitiesByPartitionKey(partitionKey);
      return entities.length;
    } catch (error) {
      return { error: "Failed to retrieve count from storage" };
    }
  }

  /**
   * Validates if a language is supported
   */
  public isLanguageSupported(language: string): boolean {
    return this.mapLanguageToPartitionKey(language) !== null;
  }
}
