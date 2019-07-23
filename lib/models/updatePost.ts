import { Types, Document, Model, Schema, Query, model } from 'mongoose'
import Debug from 'debug'
import uuidv4 from 'uuid/v4'

export interface UpdatePostDocument extends Document {
  pathPattern: string
  patternPrefix: string
  patternPrefix2: string
  channel: string
  provider: string
  creator: Schema.Types.ObjectId
  createdAt: Date
}

export interface UpdatePostModel extends Model<UpdatePostDocument> {
  normalizeChannelName(channel): any
  createPrefixesByPathPattern(pathPattern): any
  getRegExpByPattern(pattern): any
  findSettingsByPath(path): any
  findAll(offset): any
  createUpdatePost(pathPattern: string, channel: string, creator: Types.ObjectId): Promise<UpdatePostDocument>
}

/**
 * This is the setting for notify to 3rd party tool (like Slack).
 */
export default crowi => {
  const debug = Debug('crowi:models:updatePost')

  // TODO: slack 以外の対応
  const updatePostSchema = new Schema<UpdatePostDocument, UpdatePostModel>({
    pathPattern: { type: String, required: true },
    patternPrefix: { type: String, required: true },
    patternPrefix2: { type: String, required: true },
    channel: { type: String, required: true },
    provider: { type: String, required: true },
    creator: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    createdAt: { type: Date, default: Date.now },
  })

  updatePostSchema.statics.normalizeChannelName = function(channel) {
    return channel.replace(/(#|,)/g, '')
  }

  updatePostSchema.statics.createPrefixesByPathPattern = function(pathPattern) {
    var patternPrefix = ['*', '*']

    // not begin with slash
    if (!pathPattern.match(/^\/.+/)) {
      return patternPrefix
    }

    var pattern = pathPattern.split('/')
    pattern.shift()
    if (pattern[0] && pattern[0] != '*') {
      patternPrefix[0] = pattern[0]
    }

    if (pattern[1] && pattern[1] != '*') {
      patternPrefix[1] = pattern[1]
    }
    return patternPrefix
  }

  updatePostSchema.statics.getRegExpByPattern = function(pattern) {
    var reg = pattern
    if (!reg.match(/^\/.*/)) {
      reg = '/*' + reg + '*'
    }
    reg = '^' + reg
    reg = reg.replace(/\//g, '\\/')
    reg = reg.replace(/(\*)/g, '.*')

    return new RegExp(reg)
  }

  updatePostSchema.statics.findSettingsByPath = function(path) {
    var UpdatePost = this
    var prefixes = UpdatePost.createPrefixesByPathPattern(path)

    return new Promise(function(resolve, reject) {
      UpdatePost.find({
        $or: [
          { patternPrefix: prefixes[0], patternPrefix2: prefixes[1] },
          { patternPrefix: '*', patternPrefix2: '*' },
          { patternPrefix: prefixes[0], patternPrefix2: '*' },
          { patternPrefix: '*', patternPrefix2: prefixes[1] },
        ],
      }).then(function(settings) {
        if (settings.length <= 0) {
          return resolve(settings)
        }

        settings = settings.filter(function(setting) {
          var patternRegex = UpdatePost.getRegExpByPattern(setting.pathPattern)
          return patternRegex.test(path)
        })

        return resolve(settings)
      })
    })
  }

  updatePostSchema.statics.findAll = function(offset) {
    var UpdatePost = this
    var offset = offset || 0

    return new Promise(function(resolve, reject) {
      UpdatePost.find()
        .sort({ createdAt: 1 })
        .populate('creator')
        .exec(function(err, data) {
          if (err) {
            return reject(err)
          }

          if (data.length < 1) {
            return resolve([])
          }

          return resolve(data)
        })
    })
  }

  updatePostSchema.statics.createUpdatePost = async function(pathPattern, channel, creator) {
    const UpdatePost = this
    const provider = 'slack' // now slack only

    const prefixes = UpdatePost.createPrefixesByPathPattern(pathPattern)

    return UpdatePost.create({
      pathPattern,
      patternPrefix: prefixes[0],
      patternPrefix2: prefixes[1],
      channel: UpdatePost.normalizeChannelName(channel),
      provider,
      creator,
      createdAt: Date.now(),
    })
  }

  return model('UpdatePost', updatePostSchema)
}