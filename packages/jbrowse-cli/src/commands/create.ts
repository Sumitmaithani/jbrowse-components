import { Command, flags } from '@oclif/command'
import * as fs from 'fs'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'
import * as unzip from 'unzipper'

interface GithubRelease {
  tag_name: string
  prerelease: boolean
  assets: [
    {
      browser_download_url: string
    },
  ]
}
export default class Create extends Command {
  static description = 'Downloads and installs the latest JBrowse 2 release'

  static examples = [
    '$ jbrowse create /path/to/new/installation',
    '$ jbrowse create /path/to/new/installation --force',
    '$ jbrowse create /path/to/new/installation --url url.com/directjbrowselink.zip',
    '$ jbrowse create /path/to/new/installation --tag @gmod/jbrowse-web@0.0.1',
    '$ jbrowse create --listVersion',
  ]

  static args = [
    {
      name: 'localPath',
      required: true,
      description: `Location where JBrowse 2 will be installed`,
    },
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    force: flags.boolean({
      char: 'f',
      description:
        'Overwrites existing JBrowse 2 installation if present in path',
    }),
    listVersions: flags.boolean({
      char: 'l',
      description: 'Lists out all versions of JBrowse 2',
    }),
    url: flags.string({
      char: 'u',
      description: 'A direct URL to a JBrowse 2 release',
    }),
    tag: flags.string({
      char: 't',
      description:
        'Version of JBrowse 2 to install. Format is @gmod/jbrowse-web@0.0.1.\nDefaults to latest',
    }),
  }

  async run() {
    const { args: runArgs, flags: runFlags } = this.parse(Create)
    const { localPath: argsPath } = runArgs as { localPath: string }
    this.debug(`Want to install path at: ${argsPath}`)

    const { force, url, listVersions, tag } = runFlags

    if (listVersions) {
      try {
        const versions = (await this.fetchGithubVersions()).map(
          version => version.tag_name,
        )
        this.log(`All JBrowse versions: ${versions.join(', ')}`)
        this.exit()
      } catch (error) {
        this.error(error)
      }
    }

    // mkdir will do nothing if dir exists
    try {
      await fsPromises.mkdir(argsPath, { recursive: true })
    } catch (error) {
      this.error(error)
    }

    if (!force) await this.checkPath(argsPath)

    const locationUrl = url || (await this.getTagOrLatest(tag))

    let response
    try {
      response = await fetch(locationUrl, {
        method: 'GET',
      })
    } catch (error) {
      this.error(error)
    }
    if (!response.ok)
      this.error(`Failed to fetch JBrowse2 from server`, { exit: 50 })

    if (
      url &&
      response.headers.get('content-type') !== 'application/zip' &&
      response.headers.get('content-type') !== 'application/octet-stream'
    )
      this.error(
        'The URL provided does not seem to be a JBrowse installation URL',
      )

    response.body
      .pipe(unzip.Parse())
      .on('entry', async (entry: unzip.Entry) => {
        const { path: fileName, type } = entry
        if (type === 'File') {
          try {
            const location = path.join(argsPath, fileName)
            await fsPromises.mkdir(path.dirname(location), {
              recursive: true,
            })
            entry.pipe(fs.createWriteStream(path.join(argsPath, fileName)))
          } catch (error) {
            this.error(error)
          }
        } else entry.autodrain()
      })
      .on('error', err => {
        fs.unlink(argsPath, () => {})
        this.error(
          `Failed to download JBrowse 2 with ${err}. Please try again later`,
        )
      })
      .on('close', () => {
        this.log(`Your JBrowse 2 setup has been created at ${argsPath}`)
      })
  }

  async checkPath(userPath: string) {
    let allFiles
    try {
      allFiles = await fsPromises.readdir(userPath)
    } catch (error) {
      this.error('Directory does not exist', { exit: 20 })
    }
    if (allFiles.length > 0)
      this.error(
        `${userPath} This directory has existing files and could cause conflicts with create. Please choose another directory or use the force flag to overwrite existing files`,
        { exit: 10 },
      )
  }

  async fetchGithubVersions() {
    const response = await fetch(
      'https://api.github.com/repos/GMOD/jbrowse-components/releases',
    )

    if (!response.ok) {
      this.error('Failed to fetch version from server')
    }

    // use all release only if there are only pre-release in repo
    const jb2releases: GithubRelease[] = await response.json()
    const versions = jb2releases.filter(release =>
      release.tag_name.startsWith('@gmod/jbrowse-web'),
    )

    const nonprereleases = versions.filter(
      release => release.prerelease === false,
    )

    return nonprereleases.length === 0 ? jb2releases : nonprereleases
  }

  async getTagOrLatest(tag?: string) {
    const response = await this.fetchGithubVersions()
    const versions = tag
      ? response.find(version => version.tag_name === tag)
      : response[0]

    return versions
      ? versions.assets[0].browser_download_url
      : this.error(
          'Could not find version specified. Use --listVersions to see all available versions',
          { exit: 40 },
        )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async catch(error: any) {
    if (error.parse && error.parse.output.flags.listVersions) {
      const versions = (await this.fetchGithubVersions()).map(
        version => version.tag_name,
      )
      this.log(`All JBrowse versions: ${versions.join(', ')}`)
      this.exit()
    }
    throw error
  }
}