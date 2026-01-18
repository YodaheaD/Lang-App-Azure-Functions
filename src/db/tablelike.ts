import { TableClient, TableEntity } from "@azure/data-tables";

const connectionString = process.env.AzureWebJobsStorage;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const cache = new Map<string, CacheEntry<any>>();

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
  private buildODataFilter(
    partitionKey: string,
    filters?: FilterOptions
  ): string {
    let filterParts = [`PartitionKey eq '${partitionKey}'`];

    if (filters) {
      if (filters.class && filters.class.length > 0) {
        const classFilters = filters.class.map(
          (c) => `class eq '${c.replace(/'/g, "''")}'`
        );
        filterParts.push(`(${classFilters.join(" or ")})`);
      }

      if (filters.class2 && filters.class2.length > 0) {
        const class2Filters = filters.class2.map(
          (c) => `class2 eq '${c.replace(/'/g, "''")}'`
        );
        filterParts.push(`(${class2Filters.join(" or ")})`);
      }
    }

    return filterParts.join(" and ");
  }

  /**
   * Retrieves all entities for a given partition key with optional filtering
   * Uses cache to avoid repeated Azure Table scans
   */
  private async getEntitiesByPartitionKey(
    partitionKey: string,
    filters?: FilterOptions
  ): Promise<Type[]> {
    const cacheKey = `entities:${partitionKey}`;
    const countCacheKey = `count:${partitionKey}`;

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      // Cache hit - defensively clone to prevent mutation of cached data
      const base = [...cached.value];
      return this.filterEntitiesInMemory(base, filters);
    }

    // Cache miss - query table
    const entities: Type[] = [];
    const odataFilter = `PartitionKey eq '${partitionKey}'`; // Get all entities for partition

    const listResults = this.client.listEntities<Type>({
      queryOptions: { filter: odataFilter },
    });

    for await (const entity of listResults) {
      entities.push(entity);
    }

    // Store both entities and count in cache
    const expiresAt = Date.now() + CACHE_TTL_MS;
    cache.set(cacheKey, {
      value: entities,
      expiresAt,
    });
    cache.set(countCacheKey, {
      value: entities.length,
      expiresAt,
    });

    // Apply filters in memory and return
    return this.filterEntitiesInMemory(entities, filters);
  }

  /**
   * Filters entities in memory based on filter options
   */
  private filterEntitiesInMemory(
    entities: Type[],
    filters?: FilterOptions
  ): Type[] {
    if (!filters) {
      return entities;
    }

    return entities.filter((entity) => {
      // Apply class filter
      if (filters.class && filters.class.length > 0) {
        const entityClass = (entity as any).class;
        if (!filters.class.includes(entityClass)) {
          return false;
        }
      }

      // Apply class2 filter
      if (filters.class2 && filters.class2.length > 0) {
        const entityClass2 = (entity as any).class2;
        if (!filters.class2.includes(entityClass2)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Sorts Japanese entities by type, then by word within each type
   */
  private sortJapaneseEntities(entities: Type[]): Type[] {
    // Group entities by type
    const typeGroups = new Map<string, Type[]>();

    for (const entity of entities) {
      const type = (entity as any).type || "unknown";
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
        const wordA = ((a as any).Word || (a as any).word || "")
          .toString()
          .toLowerCase();
        const wordB = ((b as any).Word || (b as any).word || "")
          .toString()
          .toLowerCase();
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
      const classValue = (entity as any).class || "unknown";
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
        const wordA = ((a as any).Word || (a as any).word || "")
          .toString()
          .toLowerCase();
        const wordB = ((b as any).Word || (b as any).word || "")
          .toString()
          .toLowerCase();
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
  private paginateEntities(
    entities: Type[],
    page: number,
    limit: number
  ): Type[] {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    return entities.slice(startIndex, endIndex);
  }

  /**
   * Gets all unique filter values for a specific language, optionally filtered by current context
   */
  public async getAvailableFilters(
    language: string,
    contextFilters?: FilterOptions
  ): Promise<AvailableFilters | { error: string }> {
    const partitionKey = this.mapLanguageToPartitionKey(language);
    if (!partitionKey) {
      return { error: "Invalid language" };
    }

    try {
      // Create cache key that includes context filters
      const filtersCacheKey = `filters:${partitionKey}:${JSON.stringify(
        contextFilters || {}
      )}`;

      // Check cache first
      const cachedFilters = cache.get(filtersCacheKey);
      if (cachedFilters && cachedFilters.expiresAt > Date.now()) {
        return cachedFilters.value;
      }

      // Get entities that match the context filters (if any)
      const entities = await this.getEntitiesByPartitionKey(
        partitionKey,
        contextFilters
      );

      const classValues = new Set<string>();
      const class2Values = new Set<string>();

      // Extract unique values from filtered entities only
      for (const entity of entities) {
        const classValue = (entity as any).class;
        const class2Value = (entity as any).class2;

        if (classValue && typeof classValue === "string" && classValue.trim()) {
          classValues.add(classValue.trim());
        }

        if (
          class2Value &&
          typeof class2Value === "string" &&
          class2Value.trim()
        ) {
          class2Values.add(class2Value.trim());
        }
      }

      const result = {
        class: Array.from(classValues).sort(),
        class2: Array.from(class2Values).sort(),
      };

      // Cache the result
      cache.set(filtersCacheKey, {
        value: result,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      return result;
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
      // Get available filters for this language, contextually filtered
      const availableFiltersResult = await this.getAvailableFilters(
        language,
        filters
      );
      const availableFilters =
        "error" in availableFiltersResult ? undefined : availableFiltersResult;

      // Get total count without filters for reference
      const totalEntities = await this.getEntitiesByPartitionKey(partitionKey);
      const totalCount = totalEntities.length;

      // Get filtered entities
      let entities = await this.getEntitiesByPartitionKey(
        partitionKey,
        filters
      );
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
        availableFilters,
      };
    } catch (error) {
      return { error: "Failed to retrieve data from storage" };
    }
  }

  /**
   * Given only the language, returns available filters without any data or pagination
   */
  public async getFiltersOnly(language: string): Promise<any> {
    // Map language to partition key
    const partitionKey = this.mapLanguageToPartitionKey(language);
    if (!partitionKey) {
      return { error: "Invalid language" };
    }

    try {
      // Get available filters for this language, contextually filtered
      const availableFiltersResult = await this.getAvailableFilters(
        language,
        {}
      );
      const availableFilters =
        "error" in availableFiltersResult ? undefined : availableFiltersResult;

      return {
        availableFilters,
      };
    } catch (error) {
      return { error: "Failed to retrieve data from storage" };
    }
  }

  /**
   * Gets the total count of entities for a specific language
   */
  public async getCountForLanguage(
    language: string
  ): Promise<number | { error: string }> {
    // Map language to partition key
    const partitionKey = this.mapLanguageToPartitionKey(language);
    if (!partitionKey) {
      return { error: "Invalid language" };
    }

    try {
      const countCacheKey = `count:${partitionKey}`;

      // Check count cache first
      const cachedCount = cache.get(countCacheKey);
      if (cachedCount && cachedCount.expiresAt > Date.now()) {
        return cachedCount.value;
      }

      // Count cache miss - get entities (which will populate both caches)
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
   * Invalidates cache entries for a specific partition key
   */
  private invalidateCacheForPartition(partitionKey: string): void {
    const entitiesCacheKey = `entities:${partitionKey}`;
    const countCacheKey = `count:${partitionKey}`;

    // Invalidate main caches
    cache.delete(entitiesCacheKey);
    cache.delete(countCacheKey);

    // Invalidate all filter caches for this partition
    // Since filters cache keys contain the partition, we need to find and delete them
    const filtersCachePrefix = `filters:${partitionKey}:`;
    for (const [key] of cache) {
      if (key.startsWith(filtersCachePrefix)) {
        cache.delete(key);
      }
    }
  }

  /**
   * Uploads/inserts a single entity to the table
   */
  public async uploadEntity(
    entity: Type
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.createEntity(entity);

      // Invalidate cache for the entity's partition
      if (entity.partitionKey) {
        this.invalidateCacheForPartition(entity.partitionKey.toString());
      }

      return { success: true };
    } catch (error: any) {
      console.error("Error uploading entity:", error);
      return {
        success: false,
        error: error.message || "Unknown error occurred",
      };
    }
  }

  /**
   * Uploads multiple entities in batch
   */
  public async uploadEntities(
    entities: Type[]
  ): Promise<{
    success: boolean;
    uploaded: number;
    failed: number;
    errors: string[];
  }> {
    let uploaded = 0;
    let failed = 0;
    const errors: string[] = [];
    const partitionsToInvalidate = new Set<string>();

    for (const entity of entities) {
      const result = await this.uploadEntity(entity);
      if (result.success) {
        uploaded++;
        // Track partitions that need cache invalidation
        if (entity.partitionKey) {
          partitionsToInvalidate.add(entity.partitionKey.toString());
        }
      } else {
        failed++;
        if (result.error) {
          errors.push(
            `Failed to upload entity with key ${entity.rowKey}: ${result.error}`
          );
        }
      }
    }

    // Invalidate cache for all affected partitions
    // Note: We do this after processing to avoid redundant invalidations
    // since uploadEntity already invalidates per entity

    return {
      success: failed === 0,
      uploaded,
      failed,
      errors,
    };
  }
}
