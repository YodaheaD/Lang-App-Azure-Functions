import { TableClient, TableEntity } from "@azure/data-tables";
import { randomUUID } from "crypto";

const connectionString = process.env.AzureWebJobsStorage;

export interface SetEntity {
  partitionKey: string;
  rowKey: string;
  setName: string;
  setFolder: string;
  description: string;
  dateCreated: string;
  dateModified: string;
  createdAt: string;
}

export interface SetWordEntity {
  partitionKey: string; // This will be the set's rowKey
  rowKey: string;
  setName: string;
  language: string;
  addedAt: string;
  word: string;
  definition: string;
  type: string;
  class: string;
  reading: string;
  createdAt: string;
}

export interface WordEntity {
  partitionKey: string;
  rowKey: string;
  word: string;
  definition: string;
  class: string;
  language: string;
  createdAt: string;
  type: string;
  reading: string;
}

export interface CreateSetData {
  partitionKey: string;
  setName: string;
  setFolder: string;
  description: string;
}

export interface CreateSetWithTermsData extends CreateSetData {
  rowKeys: string[];
}

export interface PaginatedSetsResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

export default class SetTableLike<Type extends TableEntity<object>> {
  private client: TableClient;
  private setwordsClient: TableClient;
  private wordsClient: TableClient;

  constructor(public readonly tableName: string) {
    if (!connectionString) {
      throw new Error("Azure Storage connection string not found");
    }
    this.client = TableClient.fromConnectionString(connectionString, tableName);
    this.setwordsClient = TableClient.fromConnectionString(connectionString, "setwords");
    this.wordsClient = TableClient.fromConnectionString(connectionString, "words");
  }

  /**
   * Checks if a set already exists with the given name, folder, and partition key
   */
  public async checkSetExists(
    setName: string,
    setFolder: string,
    partitionKey: string
  ): Promise<boolean> {
    const filter = `setName eq '${setName}' and setFolder eq '${setFolder}' and partitionKey eq '${partitionKey}'`;
    
    const entities = [];
    const listResults = this.client.listEntities({
      queryOptions: { filter },
    });
    
    for await (const entity of listResults) {
      entities.push(entity);
    }
    
    return entities.length > 0;
  }

  /**
   * Creates a new set
   */
  public async createSet(data: CreateSetData): Promise<{ success: boolean; error?: string; setRowKey?: string }> {
    try {
      // Check if set already exists
      const exists = await this.checkSetExists(data.setName, data.setFolder, data.partitionKey);
      if (exists) {
        return {
          success: false,
          error: `Set with Name: ${data.setName} already exists for Language: ${data.partitionKey}`
        };
      }

      // Create the set entity
      const setRowKey = randomUUID();
      const newSetEntity = {
        partitionKey: data.partitionKey,
        rowKey: setRowKey,
        setName: data.setName,
        setFolder: data.setFolder,
        description: data.description,
        dateCreated: new Date().toISOString(),
        dateModified: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      await this.client.createEntity(newSetEntity);
      
      return {
        success: true,
        setRowKey
      };
    } catch (error) {
      return {
        success: false,
        error: "Error creating new set"
      };
    }
  }

  /**
   * Creates a set with terms
   */
  public async createSetWithTerms(data: CreateSetWithTermsData): Promise<{ success: boolean; error?: string; setRowKey?: string }> {
    try {
      // First create the set
      const setResult = await this.createSet(data);
      if (!setResult.success) {
        return setResult;
      }

      const setRowKey = setResult.setRowKey!;

      // Then add the terms
      const addTermsResult = await this.addTermsToSet(setRowKey, data.rowKeys);
      if (!addTermsResult.success) {
        return {
          success: false,
          error: addTermsResult.error
        };
      }

      return {
        success: true,
        setRowKey
      };
    } catch (error) {
      return {
        success: false,
        error: "Error creating set with terms"
      };
    }
  }

  /**
   * Adds terms to an existing set
   */
  public async addTermsToSet(setRowKey: string, wordRowKeys: string[]): Promise<{ success: boolean; error?: string }> {
    try {
      const successfulAdditions: string[] = [];
      const failedAdditions: string[] = [];

      for (const wordRowKey of wordRowKeys) {
        try {
          // Get the word from the words table
          const wordFilter = `RowKey eq '${wordRowKey}'`;
          const wordEntities = [];
          const wordResults = this.wordsClient.listEntities({
            queryOptions: { filter: wordFilter },
          });
          
          for await (const entity of wordResults) {
            wordEntities.push(entity);
          }

          if (wordEntities.length === 0) {
            failedAdditions.push(wordRowKey);
            continue;
          }

          const wordEntity = wordEntities[0] as any;

          // Create setword entity
          const setWordEntity = {
            partitionKey: setRowKey,
            rowKey: randomUUID(),
            setName: "", // This could be populated if needed
            language: wordEntity.partitionKey,
            addedAt: new Date().toISOString(),
            word: wordEntity.word || wordEntity.Word || "",
            definition: wordEntity.definition || wordEntity.Definition || "",
            type: wordEntity.type || "",
            class: wordEntity.class || wordEntity.Class || "",
            reading: wordEntity.reading || "",
            createdAt: wordEntity.createdAt || new Date().toISOString(),
          };

          await this.setwordsClient.createEntity(setWordEntity);
          successfulAdditions.push(wordRowKey);
        } catch (error) {
          failedAdditions.push(wordRowKey);
        }
      }

      if (failedAdditions.length > 0) {
        return {
          success: false,
          error: `Failed to add ${failedAdditions.length} terms`
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: "Error adding terms to set"
      };
    }
  }

  /**
   * Removes terms from a set
   */
  public async removeTermsFromSet(setRowKey: string, wordRowKeys: string[]): Promise<{ success: boolean; error?: string }> {
    try {
      for (const wordRowKey of wordRowKeys) {
        const filter = `PartitionKey eq '${setRowKey}'`;
        const entities = [];
        const listResults = this.setwordsClient.listEntities({
          queryOptions: { filter },
        });
        
        for await (const entity of listResults) {
          const wordEntity = entity as any;
          // Find matching word to remove
          if (wordEntity.rowKey === wordRowKey || 
              (wordEntity.word && wordEntity.word.toLowerCase().includes(wordRowKey.toLowerCase()))) {
            await this.setwordsClient.deleteEntity(entity.partitionKey, entity.rowKey);
          }
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: "Error removing terms from set"
      };
    }
  }

  /**
   * Deletes a set and all its associated terms
   */
  public async deleteSet(rowKey: string, partitionKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      // First delete all setwords for this set
      const filter = `PartitionKey eq '${rowKey}'`;
      const setwordEntities = [];
      const listResults = this.setwordsClient.listEntities({
        queryOptions: { filter },
      });
      
      for await (const entity of listResults) {
        setwordEntities.push(entity);
      }

      // Delete all setword entities
      for (const entity of setwordEntities) {
        await this.setwordsClient.deleteEntity(entity.partitionKey, entity.rowKey);
      }

      // Then delete the set itself
      await this.client.deleteEntity(partitionKey, rowKey);
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: "Error deleting set"
      };
    }
  }

  /**
   * Gets a set by row key
   */
  public async getSetByRowKey(rowKey: string): Promise<Type | null> {
    try {
      const filter = `RowKey eq '${rowKey}'`;
      const entities = [];
      const listResults = this.client.listEntities<Type>({
        queryOptions: { filter },
      });
      
      for await (const entity of listResults) {
        entities.push(entity);
      }
      
      return entities.length > 0 ? entities[0] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Gets a set by name, folder, and language
   */
  public async getSetByNameFolderLanguage(
    setName: string,
    setFolder: string,
    language: string
  ): Promise<Type | null> {
    try {
      const filter = `setName eq '${setName}' and setFolder eq '${setFolder}' and partitionKey eq '${language}'`;
      const entities = [];
      const listResults = this.client.listEntities<Type>({
        queryOptions: { filter },
      });
      
      for await (const entity of listResults) {
        entities.push(entity);
      }
      
      return entities.length > 0 ? entities[0] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Gets all sets with pagination
   */
  public async getAllSets(
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedSetsResult<Type> | { error: string }> {
    try {
      // Validate pagination parameters
      if (page < 1 || limit < 1) {
        return { error: "Page and limit must be positive numbers" };
      }

      const entities: Type[] = [];
      const listResults = this.client.listEntities<Type>();
      
      for await (const entity of listResults) {
        entities.push(entity);
      }

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedData = entities.slice(startIndex, endIndex);

      return {
        data: paginatedData,
        page,
        limit,
        total: entities.length
      };
    } catch (error) {
      return { error: "Failed to retrieve sets" };
    }
  }

  /**
   * Gets the total count of sets
   */
  public async getSetCount(): Promise<number | { error: string }> {
    try {
      const entities = [];
      const listResults = this.client.listEntities();
      
      for await (const entity of listResults) {
        entities.push(entity);
      }
      
      return entities.length;
    } catch (error) {
      return { error: "Failed to retrieve set count" };
    }
  }

  /**
   * Gets all terms for a set
   */
  public async getSetTerms(setRowKey: string): Promise<SetWordEntity[]> {
    try {
      const filter = `PartitionKey eq '${setRowKey}'`;
      const entities: SetWordEntity[] = [];
      const listResults = this.setwordsClient.listEntities({
        queryOptions: { filter },
      });
      
      for await (const entity of listResults) {
        entities.push(entity as unknown as SetWordEntity);
      }
      
      return entities;
    } catch (error) {
      return [];
    }
  }
}
