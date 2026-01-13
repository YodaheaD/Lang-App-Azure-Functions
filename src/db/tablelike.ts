import { TableClient, TableEntity } from "@azure/data-tables";

const connectionString = process.env.AzureWebJobsStorage;

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalFiltered: number;
  appliedFilters?: FilterOptions;
  availableFilters?: AvailableFilters;
}

export interface FilterOptions {
  class?: string[];
  class2?: string[];
}

export interface AvailableFilters {
  class: string[];
  class2: string[];
}

export interface LanguageQueryOptions {
  page?: number;
  limit?: number;
  sortForJapanese?: boolean;
  filters?: FilterOptions;
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
   * Builds OData filter string from filter options
   */
  private buildODataFilter(partitionKey: string, filters?: FilterOptions): string {
    let filterParts = [`PartitionKey eq '${partitionKey}'`];

    if (filters) {
      if (filters.class && filters.class.length > 0) {
        const classFilters = filters.class.map(c => `class eq '${c.replace(/'/g, "''")}'`);
        filterParts.push(`(${classFilters.join(' or ')})`);
      }

      if (filters.class2 && filters.class2.length > 0) {
        const class2Filters = filters.class2.map(c => `class2 eq '${c.replace(/'/g, "''")}'`);
        filterParts.push(`(${class2Filters.join(' or ')})`);
      }
    }

    return filterParts.join(' and ');
  }

  /**
   * Retrieves all entities for a given partition key with optional filtering
   */
  private async getEntitiesByPartitionKey(partitionKey: string, filters?: FilterOptions): Promise<Type[]> {
    const entities: Type[] = [];
    const odataFilter = this.buildODataFilter(partitionKey, filters);
    
    const listResults = this.client.listEntities<Type>({
      queryOptions: { filter: odataFilter },
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
   * Sorts entities by class, then by word within each class
   */
  private sortEntitiesByClass(entities: Type[]): Type[] {
    // Group entities by class
    const classGroups = new Map<string, Type[]>();
    
    for (const entity of entities) {
      const classValue = (entity as any).class || 'unknown';
      if (!classGroups.has(classValue)) {
        classGroups.set(classValue, []);
      }
      classGroups.get(classValue)!.push(entity);
    }
    
    // Sort each group by word and combine back
    const sortedEntities: Type[] = [];
    
    // Sort the class groups by class name first
    const sortedClasses = Array.from(classGroups.keys()).sort();
    
    for (const classValue of sortedClasses) {
      const group = classGroups.get(classValue)!;
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
   * Gets all unique filter values for a specific language
   */
  public async getAvailableFilters(language: string): Promise<AvailableFilters | { error: string }> {
    const partitionKey = this.mapLanguageToPartitionKey(language);
    if (!partitionKey) {
      return { error: "Invalid language" };
    }

    try {
      // Get all entities for the partition (no filters)
      const entities = await this.getEntitiesByPartitionKey(partitionKey);
      
      const classValues = new Set<string>();
      const class2Values = new Set<string>();

      // Extract unique values from all entities
      for (const entity of entities) {
        const classValue = (entity as any).class;
        const class2Value = (entity as any).class2;
        
        if (classValue && typeof classValue === 'string' && classValue.trim()) {
          classValues.add(classValue.trim());
        }
        
        if (class2Value && typeof class2Value === 'string' && class2Value.trim()) {
          class2Values.add(class2Value.trim());
        }
      }

      return {
        class: Array.from(classValues).sort(),
        class2: Array.from(class2Values).sort()
      };
    } catch (error) {
      return { error: "Failed to retrieve available filters" };
    }
  }

  /**
   * Gets paginated data for a specific language with optional sorting and filtering
   */
  public async getDataForLanguage(
    language: string,
    options: LanguageQueryOptions = {}
  ): Promise<PaginatedResult<Type> | { error: string }> {
    const { page = 1, limit = 10, sortForJapanese = false, filters } = options;

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
      // Get available filters for this language
      const availableFiltersResult = await this.getAvailableFilters(language);
      const availableFilters = 'error' in availableFiltersResult ? undefined : availableFiltersResult;

      // Get total count without filters for reference
      const totalEntities = await this.getEntitiesByPartitionKey(partitionKey);
      const totalCount = totalEntities.length;

      // Get filtered entities
      let entities = await this.getEntitiesByPartitionKey(partitionKey, filters);
      const filteredCount = entities.length;

      // Apply sorting for Japanese if requested
      if (sortForJapanese && language.toLowerCase() === "japanese") {
        entities = this.sortJapaneseEntities(entities);
      } else {
        // Sort by class, then by word within each class
        entities = this.sortEntitiesByClass(entities);
      }

      // Apply pagination
      const paginatedData = this.paginateEntities(entities, page, limit);

      return {
        data: paginatedData,
        page,
        limit,
        total: totalCount,
        totalFiltered: filteredCount,
        appliedFilters: filters,
        availableFilters
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

  /**
   * Uploads/inserts a single entity to the table
   */
  public async uploadEntity(entity: Type): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.createEntity(entity);
      return { success: true };
    } catch (error: any) {
      console.error('Error uploading entity:', error);
      return { success: false, error: error.message || 'Unknown error occurred' };
    }
  }

  /**
   * Uploads multiple entities in batch
   */
  public async uploadEntities(entities: Type[]): Promise<{ success: boolean; uploaded: number; failed: number; errors: string[] }> {
    let uploaded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const entity of entities) {
      const result = await this.uploadEntity(entity);
      if (result.success) {
        uploaded++;
      } else {
        failed++;
        if (result.error) {
          errors.push(`Failed to upload entity with key ${entity.rowKey}: ${result.error}`);
        }
      }
    }

    return {
      success: failed === 0,
      uploaded,
      failed,
      errors
    };
  }
}
