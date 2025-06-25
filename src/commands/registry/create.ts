import path from 'node:path';
import fs from 'node:fs';
import { execa } from 'execa';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { findProjectRoot, getCleanTypeLabel, fileExistsAndIsFile } from '../../utils/functions.js';
import { promptComponentOrClass, promptValidNameCommandCreate } from '../../utils/prompts.js';
import { FILENAMES, PATHS } from '../../utils/constants.js';

export default class RegistryTemplate extends SfCommand<void> {
  // eslint-disable-next-line sf-plugin/no-hardcoded-messages-commands
  public static readonly summary = 'Crée un squelette composant LWC ou classe Apex avec meta JSON à compléter';
  public static readonly examples = ['$ sf registry create'];

  public async run(): Promise<void> {
    try {
      const type = await promptComponentOrClass('Quel type de template veux-tu créer ?');
      const cleanType = getCleanTypeLabel(type, false);
      const name = await promptValidNameCommandCreate(`Nom du ${cleanType}`);
      const folder = await this.getTargetFolder(type, name);
      await this.createRegistryMetaJson(folder);
      this.log(`✅ ${getCleanTypeLabel(type, false)} "${name}" créé avec succès.`);
    } catch (error) {
      this.error(`❌ Erreur inattendue: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getTargetFolder(type: 'component' | 'class', name: string): Promise<string> {
    if (type === 'component') {
      return this.createLwcComponent(name);
    }
    return this.createApexClass(name);
  }

  private async createLwcComponent(name: string): Promise<string> {
    const projectRoot = findProjectRoot(process.cwd());
    const lwcParent = path.join(projectRoot, PATHS.LWC);
    const folder = path.join(lwcParent, name);

    await fs.promises.mkdir(lwcParent, { recursive: true });
    this.log('⏳ Création du composant LWC...');
    await execa('sf', ['lightning', 'component', 'generate', '--type', 'lwc', '--name', name], {
      cwd: lwcParent,
      stdio: 'inherit', 
    });

    const jsFile = path.join(folder, `${name}.js`);
    const tsFile = path.join(folder, `${name}.ts`);
    if (await fileExistsAndIsFile(jsFile)) {
      await fs.promises.rename(jsFile, tsFile);
      this.log(`🔁 Fichier ${name}.js renommé en ${name}.ts`);
    }
    return folder;
  }

  private async createApexClass(name: string): Promise<string> {
    const projectRoot = findProjectRoot(process.cwd());
    const classesParent = path.join(projectRoot, PATHS.APEX);
    const folder = path.join(classesParent, name);

    await fs.promises.mkdir(classesParent, { recursive: true });
    this.log('⏳ Création de la classe Apex...');
    await execa('sf', ['apex', 'class', 'generate', '--name', name], {
      cwd: classesParent,
      stdio: 'inherit',
    });

    await fs.promises.mkdir(folder, { recursive: true });

    const clsPath = path.join(classesParent, `${name}.cls`);
    const metaXmlPath = path.join(classesParent, `${name}.cls-meta.xml`);

    await fs.promises.rename(clsPath, path.join(folder, `${name}.cls`));
    await fs.promises.rename(metaXmlPath, path.join(folder, `${name}.cls-meta.xml`));

    return folder;
  }

  private async createRegistryMetaJson(folder: string): Promise<void> {
    const metaPath = path.join(folder, FILENAMES.REGISTRY_META);
    const meta = { description: '', version: '' };
    try {
      await fs.promises.writeFile(metaPath, JSON.stringify(meta, null, 2));
      this.log(`✅ Fichier ${FILENAMES.REGISTRY_META} généré dans ${metaPath}`);
    } catch (error) {
      throw new Error(
        `Erreur lors de la création du fichier ${FILENAMES.REGISTRY_META}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
