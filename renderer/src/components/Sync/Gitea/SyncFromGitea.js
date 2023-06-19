import * as localForage from 'localforage';
import {
  readContent,
} from 'gitea-react-toolkit';
import { validate } from '@/util/validate';
import { checkDuplicate } from '@/core/burrito/importBurrito';
import * as logger from '../../../logger';
import { importServerProject } from './SyncFromGiteaUtils';

export async function downloadFromGitea(repo, auth, setSyncProgress, notifyStatus, setSelectedGiteaProject, addNotification, branch, setPullPopup, setPullData) {
  logger.debug('SyncFromGitea.js', 'in SyncFromGiea : onClick offline sync');
  try {
    console.log('try', branch);
    const currentUser = await localForage.getItem('userProfile');
    logger.debug('SyncFromGitea.js', 'in SyncFromGiea : fetch metadata content from branch');
    console.log({ repo });
    const readMetaData = await readContent(
      {
      config: auth.config,
      owner: repo.owner.username,
      repo: repo.name,
      ref: branch,
      filepath: 'metadata.json',
      },
    );
    console.log('after read ---------', { readMetaData });
    const fetchMetaData = await fetch(readMetaData.download_url);
    const metaFile = await fetchMetaData.json();
    console.log(metaFile);
    if (metaFile) {
      console.log('done');
      // const sb = Buffer.from(metaFile.data);
      const metaDataSB = metaFile;
      logger.debug('SyncFromGitea.js', 'in SyncFromGiea : fetch and parse metaData Success');
      // Validate the burrito
      console.log('validate');
      const success = await validate('metadata', 'gitea/metadata.json', JSON.stringify(metaDataSB), metaDataSB.meta.version);
      console.log({ success });
      // if success proceed else raise error
      if (success) {
        logger.debug('SyncFromGitea.js', 'in SyncFromGiea : metaData SB validated');
        setSyncProgress((prev) => ({
          ...prev,
          syncStarted: true,
          totalFiles: Object.keys(metaDataSB?.ingredients).length + 2,
          completedFiles: 1,
        }));
        // setProjectData
        setSelectedGiteaProject({
          repo,
          branch,
          metaDataSB,
          localUsername: currentUser.username,
          auth,
          mergeStatus: false,
        });
        // check for project exising - true/ undefined
        const duplicate = await checkDuplicate(metaDataSB, currentUser?.username, 'projects');
        // if (duplicate) {
        //   logger.debug('SyncFromGitea.js', 'in SyncFromGiea : project exist and merge action');
        //   // save all data and trigger merge
        //   // setSelectedGiteaProject((prev) => ({ ...prev, mergeStatus: true }));
        // } else {
          // import call
          console.log({ duplicate });
        logger.debug('SyncFromGitea.js', 'in SyncFromGiea : new project and import called');
        await importServerProject(false, repo, metaDataSB, auth, branch, { setSyncProgress, notifyStatus }, currentUser.username, duplicate, setPullPopup, setPullData);
        await notifyStatus('success', 'Project Sync to scribe successfull');
        await addNotification('Sync', 'Project Sync Successfull', 'success');
        // }
      } else {
        logger.debug('SyncFromGitea.js', 'Burrito Validation Failed');
        throw new Error('Burrito Validation Failed');
      }
    } else { throw new Error('Failed to read MetaData'); }
  } catch (err) {
    logger.debug('SyncFromGitea.js', `In error : ${err}`);
    setSelectedGiteaProject({
      repo: null, branch: null, metaDataSB: null, localUsername: null, auth: null, mergeStatus: false,
    });
    notifyStatus('failure', `Sync Failed , ${err?.message || err}`);
    await addNotification('Sync', err?.message || err, 'failure');
  } finally {
    setSyncProgress({
        syncStarted: false,
        totalFiles: 0,
        completedFiles: 0,
    });
  }
}
