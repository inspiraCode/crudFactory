'use strict';

/**
 * Author:      Jesus Alfredo Pacheco Figueroa
 *              apacheco@capsonic.com
 *              j.alfredo.pacheco@gmail.com
 *              apacheco@inspiracode.net
 * Version:     1.1.0
 * Name:        inspiracode.crudFactory
 * Description: AnguarJS module for handling CRUD operations, 
 *              caching, validation, and sync to server.
 */

angular.module('inspiracode.crudFactory', [])

.service('validatorService', function() {
    var self = this;
    this.isValidDate = function(value) {
        var sError = '';
        var theDate = moment(value, 'MM/DD/YYYY');
        if (theDate.isValid() == false) {
            sError = 'Invalid Date.';
        }
        var minDate = moment('02/10/1985', 'MM/DD/YYYY');
        var maxDate = moment('02/10/2200', 'MM/DD/YYYY');

        if (theDate.isBefore(minDate)) {
            sError = 'Date too old.';
        }
        if (theDate.isAfter(maxDate)) {
            sError = 'Date not allowed.';
        }
        return sError;
    };

    this.isValidString = function(value) {
        var sError = '';
        if (jQuery.trim(value) == '') {
            sError = 'Empty value.';
        }
        return sError;
    };

    this.isValidNumber = function(value) {
        var sError = '';
        if (!jQuery.isNumeric(value)) {
            sError = 'Invalid number.';
        }
        return sError;
    };

    this.isValidNumberOrEmpty = function(value) {
        var sError = '';
        if (jQuery.trim(value) == '') {
            return sError;
        }
        if (!jQuery.isNumeric(value)) {
            sError = 'Invalid number.';
        }
        return sError;
    };
    this.isValidCatalog = function(value) {
        var sError = '';
        if (self.isValidNumber(value) != '' || value <= 0) {
            sError = 'Selection required.';
        }
        return sError;
    };

    this.isValidDropdown = function(value) {
        var sError = '';
        if (self.isValidNumber(value) != '' || value <= 0) {
            sError = 'Selection required.';
        }
        return sError;
    };

    this.isValidPhone = function(value) {
        var sError = 'Invalid Phone.';
        if (self.isValidString(value) == '') {
            if (value.length >= 10 && value.length <= 13) {
                sError = '';
            }
        }
        return sError;
    };

    this.isValidEmail = function(value) {
        var sError = '';
        var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

        if (!re.test(value)) {
            sError = 'Invalid Email Address.';
        }
        return sError;
    };

    this.isValidBoolean = function(value) {
        var sError = 'Invalid value.';

        if (value === true || value === false) {
            sError = '';
        }
        return sError;
    };

    this.validate = function(value, kind) {
        var sError = '';
        switch (kind) {
            case 'string':
                sError = self.isValidString(value);
                break;
            case 'number':
                sError = self.isValidNumber(value);
                break;
            case 'number?':
                sError = self.isValidNumberOrEmpty(value);
                break;
            case 'date':
                sError = self.isValidDate(value);
                break;
            case 'catalog':
                sError = self.isValidCatalog(value);
                break;
            case 'phone':
                sError = self.isValidPhone(value);
                break;
            case 'email':
                sError = self.isValidEmail(value);
                break;
            case 'boolean':
                sError = self.isValidBoolean(value);
                break;
            case 'dropdown':
                sError = self.isValidDropdown(value);
                break;
            default:
        }
        return sError;
    };

    this.getProgress = function(theEntity, requiredFields) {
        var totalFields = 0;
        var totalFieldsCompleted = 0;

        for (var field in requiredFields) {
            if (requiredFields.hasOwnProperty(field)) {
                totalFields++;
                var value = theEntity[field];
                if (self.validate(value, requiredFields[field]) == '') {
                    totalFieldsCompleted++;
                }
            }
        }

        // if (theEntity.taskEntity && theEntity.taskEntity.ToDo) {
        //     for (var i = 0; i < theEntity.taskEntity.ToDo.length; i++) {
        //         var todo = theEntity.taskEntity.ToDo[i];
        //         totalFields++;
        //         if (todo.IsDone) {
        //             totalFieldsCompleted++;
        //         }
        //     }
        // }

        return totalFieldsCompleted / totalFields * 100;
    };


})

.factory('crudFactory', function($http, $q, appConfig, $timeout, validatorService, $log) {

    var log = $log;

    //Class for create Catalog objects, which will be used on select controls
    function ClassCatalog() {
        this._arrAllRecords = [];
        this.getAll = function() {
            return this._arrAllRecords;
        };
        this.getById = function(theId) {
            for (var i = 0; i < this._arrAllRecords.length; i++) {
                if (theId == this._arrAllRecords[i].id) {
                    return this._arrAllRecords[i];
                }
            }
            return {
                id: -1,
                value: ''
            };
        };
    };

    function ClassEntity(oConfig) {
        ////////////////////////////////////////////////////////INIT CONFIG
        var _entityName = oConfig.entityName;
        var _entityDefinition = oConfig.entityDefinition;
        var _parentField = oConfig.parentField;
        var _seedField = oConfig.seedField; //Only for recursive entities.

        var _validate = oConfig.validate;
        if (!_validate) {
            _validate = function() {
                return true;
            };
        };

        var _defaults = oConfig.defaults;
        if (!_defaults) {
            _defaults = function(oEntity) {
                return oEntity;
            };
        }

        var _adapterIn = oConfig.adapterIn;
        if (!_adapterIn) {
            _adapterIn = function(oEntity) {
                return oEntity;
            };
        }

        var _adapterOut = oConfig.adapterOut;
        if (!_adapterOut) {
            _adapterOut = function(oEntity) {
                return oEntity;
            };
        }
        ////////////////////////////////////////////////////////END CONFIG

        var _create = function(parentKey, seedKey) {
            var oNewEntity = {};

            //System Fields
            for (var prop in _entityDefinition.systemFields) {
                if (_entityDefinition.systemFields.hasOwnProperty(prop)) {
                    oNewEntity[prop] = getDefaultValueForType(_entityDefinition.systemFields[prop], prop);
                }
            }

            //Optional Fields
            for (var prop in _entityDefinition.optionalFields) {
                if (_entityDefinition.optionalFields.hasOwnProperty(prop)) {
                    oNewEntity[prop] = getDefaultValueForType(_entityDefinition.optionalFields[prop], prop);
                }
            }

            //Required Fields
            for (var prop in _entityDefinition.requiredFields) {
                if (_entityDefinition.requiredFields.hasOwnProperty(prop)) {
                    oNewEntity[prop] = getDefaultValueForType(_entityDefinition.requiredFields[prop], prop);
                }
            }

            //Setting default values:
            _defaults(oNewEntity);

            //Setting parentKey:
            if (parentKey !== undefined) {
                oNewEntity[_parentField] = parentKey;
            }

            //Setting seedKey (only for recursive entites):
            if (seedKey !== undefined) {
                oNewEntity[_seedField] = seedKey;
            }


            return oNewEntity;
        };

        var _getProgress = function(theEntity) {
            return validatorService.getProgress(theEntity, _entityDefinition.requiredFields);
        };

        return {
            entityName: _entityName,
            parentField: _parentField,
            seedField: _seedField,
            create: _create,
            getProgress: _getProgress,
            defaults: _defaults,
            validate: _validate,
            adapterIn: _adapterIn,
            adapterOut: _adapterOut
        };
    };



    var getDefaultValueForType = function(sType, prop) {
        var result;
        switch (sType) {
            case 'catalog':
                result = -1;
                break;
            case 'email':
            case 'phone':
            case 'string':
            case 'number?':
                result = '';
                break;
            case 'date':
                result = null;
                break;
            case 'boolean':
                result = false;
                break;
            case 'number':
                result = 0;
                break;
            case 'list':
                result = [];
                break;
            case 'entity':
                result = null; //createChildEntity(prop);
                break;
            case 'foreign':
                result = null;
                break;
            case 'dropdown':
                result = 0;
                break;
        }
        return result;
    };

    var _mainConfig;
    var createChildEntity = function(sProperty) {
        var result = null;
        if (_mainConfig && _mainConfig.entityDefinition) {
            _mainConfig.entityDefinition;

            //System Fields
            for (var prop in _entityDefinition.systemFields) {
                if (_entityDefinition.systemFields.hasOwnProperty(prop)) {
                    oNewEntity[prop] = getDefaultValueForType(_entityDefinition.systemFields[prop], prop);
                }
            }

            //Optional Fields
            for (var prop in _entityDefinition.optionalFields) {
                if (_entityDefinition.optionalFields.hasOwnProperty(prop)) {
                    oNewEntity[prop] = getDefaultValueForType(_entityDefinition.optionalFields[prop], prop);
                }
            }

            //Required Fields
            for (var prop in _entityDefinition.requiredFields) {
                if (_entityDefinition.requiredFields.hasOwnProperty(prop)) {
                    oNewEntity[prop] = getDefaultValueForType(_entityDefinition.requiredFields[prop], prop);
                }
            }





        }
        var result = new ClassEntity(oConfig);
    };

    return function(oMainConfig) {
        _mainConfig = oMainConfig;
        var mainEntity = new ClassEntity(oMainConfig);

        var _catalogs;
        var createCatalogs = function(arrCatalogNames) {
            _catalogs = {};
            for (var i = 0; i < arrCatalogNames.length; i++) {
                var current = arrCatalogNames[i];
                _catalogs[current] = new ClassCatalog(current);
            }
        };


        //INIT CONFIG/////////////////////////////////////////////////////////////////////////////////////////////////////////
        createCatalogs(oMainConfig.catalogs);
        var _adapter = oMainConfig.adapter;
        var _arrDependencies = angular.copy(oMainConfig.dependencies);
        var _arrDependenciesAndThis = angular.copy(oMainConfig.dependencies); //almost at the end of the file we add "This"
        //END CONFIG//////////////////////////////////////////////////////////////////////////////////////////////////////////


        var _arrAllRecords = [];

        var _getById = function(theId) {
            for (var i = 0; i < _arrAllRecords.length; i++) {
                if (theId == _arrAllRecords[i].id) {
                    return _adapter(_arrAllRecords[i], _self);
                }
            }
            return null;
        };

        var _getByParentId = function(theParentId) {
            var result = [];
            for (var i = 0; i < _arrAllRecords.length; i++) {
                if (theParentId == _arrAllRecords[i][mainEntity.parentField]) {
                    result.push(_adapter(_arrAllRecords[i], _self));
                }
            }
            return result;
        };

        var _getSingleByParentId = function(theParentId) {
            for (var i = 0; i < _arrAllRecords.length; i++) {
                if (theParentId == _arrAllRecords[i][mainEntity.parentField]) {
                    return _adapter(_arrAllRecords[i], _self);
                }
            }
            return null;
        };

        var _getRecursiveBySeedId = function(theSeedId) {
            for (var i = 0; i < _arrAllRecords.length; i++) {
                if (theSeedId == _arrAllRecords[i][mainEntity.seedField]) {
                    return _adapter(_arrAllRecords[i], _self);
                }
            }
            return null;
        };

        var _getAll = function() {
            for (var i = 0; i < _arrAllRecords.length; i++) {
                _arrAllRecords[i] = _adapter(_arrAllRecords[i], _self);
            }
            return _arrAllRecords;
        };

        var _save = function(theEntity, theArrayBelonging, theParameters) {
            var deferred = $q.defer();
            if (theParameters === undefined || theParameters == null) {
                theParameters = '';
            }

            if (mainEntity.validate(theEntity)) {

                // New Entity
                if (theEntity.id < 1) {


                    $http.post(appConfig.API_URL + mainEntity.entityName + theParameters, "=" + escape(JSON.stringify(theEntity)))
                        .then(function(response) {
                            if (typeof response.data === 'object') {
                                var backendResponse = response.data;
                                if (!backendResponse.ErrorThrown) {
                                    _adapter(backendResponse.Result, _self);
                                    angular.copy(backendResponse.Result, theEntity);
                                    if (angular.isArray(theArrayBelonging)) {
                                        var theEntityCopy = angular.copy(theEntity);
                                        _arrAllRecords.push(theEntityCopy);
                                        theArrayBelonging.push(theEntity);
                                    } else {
                                        _arrAllRecords.push(theEntity);
                                    }
                                    $timeout(function() {
                                        alertify.success(backendResponse.ResponseDescription);
                                    }, 100);
                                    deferred.resolve(response.data);
                                } else {
                                    alertify.alert(backendResponse.ResponseDescription).set('modal', true);
                                    log.debug(response);
                                    deferred.reject(response.data);
                                }
                            } else {
                                // invalid response
                                alertify.alert('An error has occurred, see console for more details.').set('modal', true);
                                log.debug(response);
                                deferred.reject(response.data);
                            }
                        }, function(response) {
                            // something went wrong
                            alertify.alert('Error: ' + response.statusText).set('modal', true);
                            log.debug(response);
                            deferred.reject(response.data);
                        });


                } else { // Update Entity
                    $http.put(appConfig.API_URL + mainEntity.entityName + '/' + theEntity.id + theParameters, '=' + escape(JSON.stringify(theEntity)))
                        .then(function(response) {
                            if (typeof response.data === 'object') {
                                var backendResponse = response.data;
                                if (!backendResponse.ErrorThrown) {
                                    theEntity.editMode = false;
                                    var current = _getById(theEntity.id);
                                    if (!angular.equals(theEntity, current)) {
                                        angular.copy(theEntity, current);
                                    }
                                    $timeout(function() {
                                        alertify.success(backendResponse.ResponseDescription);
                                    }, 100);
                                    deferred.resolve(response.data);
                                } else {
                                    alertify.alert(backendResponse.ResponseDescription).set('modal', true);
                                    log.debug(response);
                                    deferred.reject(response.data);
                                }
                            } else {
                                // invalid response
                                alertify.alert('An error has occurred, see console for more details.').set('modal', true);
                                log.debug(response);
                                deferred.reject(response.data);
                            }
                        }, function(response) {
                            // something went wrong
                            alertify.alert('Error: ' + response.statusText).set('modal', true);
                            log.debug(response);
                            deferred.reject(response.data);
                        });
                }
            } else {
                deferred.reject();
            }
            return deferred.promise;
        };
        // var _saveBatchSerial = function(arrEntities, index, callBackSuccess, callBackError, callBackComplete) {
        //     if (arrEntities[i]) {
        //         _save(arrEntities[i]).then(function(data) {
        //             callBackSuccess(data);
        //         }, function(data) {
        //             callBackError(data);
        //         }).finally(function() {
        //             index++;
        //             _saveBatchSerial(arrEntities, index, callBackSuccess, callBackError, callba);
        //         });
        //     }
        //     callBackComplete();
        // };
        var _addBatch = function(addQty, theArrayBelonging) {
            var promises = [];
            for (var i = 0; i < addQty; i++) {
                var oEntityToCreate = mainEntity.create();
                var promise = _save(oEntityToCreate, theArrayBelonging);
                promises.push(promise);
            }
            return $q.all(promises);
        };
        var _remove = function(theEntity, theArrayBelonging) {
            return $http.delete(appConfig.API_URL + mainEntity.entityName + '/' + theEntity.id)
                .then(function(response) {
                    if (typeof response.data === 'object') {
                        var backendResponse = response.data;
                        if (!backendResponse.ErrorThrown) {
                            for (var i = 0; i < _arrAllRecords.length; i++) {
                                if (_arrAllRecords[i].id == theEntity.id) {
                                    _arrAllRecords.splice(i, 1);
                                    break;
                                }
                            }
                            if (angular.isArray(theArrayBelonging)) {
                                for (var i = 0; i < theArrayBelonging.length; i++) {
                                    if (theArrayBelonging[i].id == theEntity.id) {
                                        theArrayBelonging.splice(i, 1);
                                        break;
                                    }
                                }
                            }
                            $timeout(function() {
                                alertify.success(backendResponse.ResponseDescription);
                            }, 100);
                            return response.data;
                        } else {
                            alertify.alert(backendResponse.ResponseDescription).set('modal', true);
                            log.debug(response);
                            return $q.reject(response.data);
                        }
                    } else {
                        // invalid response
                        alertify.alert('An error has occurred, see console for more details.').set('modal', true);
                        log.debug(response);
                        return $q.reject(response.data);
                    }
                }, function(response) {
                    // something went wrong
                    alertify.alert('Error: ' + response.statusText).set('modal', true);
                    log.debug(response);
                    return $q.reject(response.data);
                });
        };

        var _removeSelected = function(arrEntities) {
            var arrItems;
            if (arrEntities) {
                arrItems = arrEntities;
            } else {
                arrItems = _arrAllRecords;
            }

            var arrItemsToRemove = [];
            var promises = [];
            for (var i = arrItems.length - 1; i > -1; i--) {
                var current = arrItems[i];
                if (current.checked) {
                    arrItemsToRemove.push(current);
                }
            }

            for (var j = 0; j < arrItemsToRemove.length; j++) {
                var oEntity = arrItemsToRemove[j];
                var promise = _remove(oEntity, arrEntities);
                promises.push(promise);
            };

            return $q.all(promises);
        };

        var _loadEntity = function(id, qParams) {
            var deferred = $q.defer();
            if (qParams === undefined || qParams == null) {
                qParams = '?';
            }
            $http.get(appConfig.API_URL + mainEntity.entityName + '/' + id + qParams + '&noCache=' + Number(new Date()))
                .success(function(data) {
                    var backendResponse = data;
                    if (backendResponse.ErrorThrown) {
                        deferred.reject(data);
                    } else {
                        mainEntity.adapterIn(backendResponse.Result);
                        var oEntity = _getById(backendResponse.Result.id);
                        if (oEntity) { //Already exists, lets updated it.
                            angular.copy(backendResponse.Result, oEntity);
                        } else { //First time loaded, lets add it.
                            _arrAllRecords.push(backendResponse.Result);
                        }
                        deferred.resolve(backendResponse.Result);
                    }
                })
                .error(function(data) {
                    // something went wrong
                    alertify.alert(data).set('modal', true);
                    deferred.reject(backendResponse.Result);
                });
            return deferred.promise;
        };

        var _removeBatch = _removeSelected;

        var _loadEntitiesExecuted = false;
        var _loadCatalogsExecuted = false;
        var _loadDependenciesExecuted = false;

        var _loadEntities = function(bForce) {
            var deferred = $q.defer();
            if (bForce) _loadEntitiesExecuted = false;
            if (_loadEntitiesExecuted) {
                deferred.resolve(_arrAllRecords);



            }
            _arrAllRecords = [];

            $http.get(appConfig.API_URL + mainEntity.entityName + '?noCache=' + Number(new Date()))
                .success(function(data) {
                    var backendResponse = data;
                    if (backendResponse.ErrorThrown) {
                        log.debug(data);
                        deferred.reject(data);

                    } else {
                        _arrAllRecords = backendResponse.Result;
                        for (var i = 0; i < _arrAllRecords.length; i++) {
                            mainEntity.adapterIn(_arrAllRecords[i]);
                        };
                        _loadEntitiesExecuted = true;
                        deferred.resolve(data);

                    }
                })
                .error(function(data) {
                    // something went wrong
                    log.debug(data);
                    deferred.reject(data);

                });

            return deferred.promise;
        };

        var _loadCatalogs = function(bForce) {
            var deferred = $q.defer();
            if (bForce) _loadCatalogsExecuted = false;
            if (_loadCatalogsExecuted) {
                deferred.resolve();
            }

            var bAtLeastOneCatalog = false;
            for (var catalog in _catalogs) {
                if (_catalogs.hasOwnProperty(catalog)) {
                    bAtLeastOneCatalog = true;
                    _catalogs[catalog]._arrAllRecords = [];
                }
            }

            if (bAtLeastOneCatalog) {
                $http.get(appConfig.API_URL + mainEntity.entityName + '/getCatalogs' + '?noCache=' + Number(new Date()))
                    .success(function(data) {
                        var backendResponse = data;
                        if (backendResponse.ErrorThrown) {
                            log.debug(response);
                            deferred.reject(data);
                        } else {
                            for (var catalog in _catalogs) {
                                if (_catalogs.hasOwnProperty(catalog)) {
                                    _catalogs[catalog]._arrAllRecords = backendResponse.Result[catalog];
                                }
                            }
                            _loadCatalogsExecuted = true;
                            deferred.resolve(data);
                        }
                    })
                    .error(function(data) {
                        // something went wrong
                        log.debug(data);
                        deferred.reject(data);
                    });
            } else {
                deferred.resolve();
            }
            return deferred.promise;
        };

        var _loadDependencies = function(bForce) {
            var promises = [];
            for (var i = 0; i < _arrDependencies.length; i++) {
                if (_arrDependencies[i].hasOwnProperty('loadCatalogs')) {
                    var promiseCatalogs = _arrDependencies[i].loadCatalogs(bForce);
                    promises.push(promiseCatalogs);
                }
                var promiseEntities = _arrDependencies[i].loadEntities(bForce);
                promises.push(promiseEntities);
            }
            promises.push(_loadCatalogs());
            return $q.all(promises);
        };

        var _loadAll = function(bForce) {
            var promises = [];
            for (var i = 0; i < _arrDependenciesAndThis.length; i++) {
                if (_arrDependenciesAndThis[i].hasOwnProperty('loadCatalogs')) {
                    var promiseCatalogs = _arrDependenciesAndThis[i].loadCatalogs(bForce);
                    promises.push(promiseCatalogs);
                }
                var promiseEntities = _arrDependenciesAndThis[i].loadEntities(bForce);
                promises.push(promiseEntities);
            }
            return $q.all(promises);
        };

        var _readByParentId = function(parentKey) {
            var deferred = $q.defer();

            $http.get(appConfig.API_URL + mainEntity.entityName + '?parentKey=' + parentKey + '&noCache=' + Number(new Date()))
                .then(
                    /*success*/
                    function(response) {
                        var backendResponse = response.data;
                        if (backendResponse.ErrorThrown) {
                            alertify.alert(backendResponse.ResponseDescription).set('modal', true);
                            deferred.reject(response);
                        } else {
                            for (var i = 0; i < backendResponse.Result.length; i++) {
                                mainEntity.adapterIn(backendResponse.Result[i]);
                            }
                            _arrAllRecords = backendResponse.Result;
                            deferred.resolve(backendResponse.Result);
                        }
                    },
                    /*error*/
                    function(response) {
                        alertify.alert('An error has occurred, see console for more details.').set('modal', true);
                        log.debug(response);
                        deferred.reject(response);
                    });

            return deferred.promise;
        };

        var _readSingleByParentId = function(parentKey) {
            var deferred = $q.defer();

            $http.get(appConfig.API_URL + mainEntity.entityName + '?parentKey=' + parentKey + '&noCache=' + Number(new Date()))
                .then(
                    /*success*/
                    function(response) {
                        var backendResponse = response.data;
                        if (backendResponse.ErrorThrown) {
                            alertify.alert(backendResponse.ResponseDescription).set('modal', true);
                            deferred.reject(response);
                        } else {
                            mainEntity.adapterIn(backendResponse.Result);
                            deferred.resolve(backendResponse.Result);
                        }
                    },
                    /*error*/
                    function(response) {
                        alertify.alert('An error has occurred, see console for more details.').set('modal', true);
                        log.debug(response);
                        deferred.reject(response);
                    });

            return deferred.promise;
        };

        var _customPost = function(sCustomMethod, oData) {
            var deferred = $q.defer();

            $http.post(appConfig.API_URL + mainEntity.entityName + '/' + sCustomMethod, "=" + escape(JSON.stringify(oData)))
                .then(function(response) {
                    if (typeof response.data === 'object') {
                        var backendResponse = response.data;
                        if (backendResponse.ErrorThrown) {
                            alertify.alert(backendResponse.ResponseDescription).set('modal', true);
                            log.debug(response);
                            deferred.reject(backendResponse);
                        } else {
                            if (angular.isArray(backendResponse.Result)) {
                                for (var i = 0; i < backendResponse.Result.length; i++) {
                                    mainEntity.adapterIn(backendResponse.Result[i]);
                                }
                            } else {
                                mainEntity.adapterIn(backendResponse.Result);
                            }

                            deferred.resolve(backendResponse.Result);
                        }
                    } else {
                        // invalid response
                        alertify.alert('An error has occurred, see console for more details.').set('modal', true);
                        log.debug(response);
                        deferred.reject(response);
                    }
                }, function(response) {
                    // something went wrong
                    alertify.alert('An error has occurred, see console for more details.').set('modal', true);
                    log.debug(response);
                    deferred.reject(response);


                });
            return deferred.promise;
        };

        var _customGet = function(sCustomMethod) {
            var deferred = $q.defer();

            $http.get(appConfig.API_URL + mainEntity.entityName + '/' + sCustomMethod)
                .then(function(response) {
                    if (typeof response.data === 'object') {
                        var backendResponse = response.data;
                        if (backendResponse.ErrorThrown) {
                            alertify.alert(backendResponse.ResponseDescription).set('modal', true);
                            log.debug(response);
                            deferred.reject(backendResponse);
                        } else {
                            if (angular.isArray(backendResponse.Result)) {
                                for (var i = 0; i < backendResponse.Result.length; i++) {
                                    mainEntity.adapterIn(backendResponse.Result[i]);
                                }
                            } else {
                                mainEntity.adapterIn(backendResponse.Result);
                            }
                            deferred.resolve(backendResponse.Result);
                        }
                    } else {
                        // invalid response
                        alertify.alert('An error has occurred, see console for more details.').set('modal', true);
                        log.debug(response);
                        deferred.reject(response);
                    }
                }, function(response) {
                    // something went wrong
                    alertify.alert('An error has occurred, see console for more details.').set('modal', true);
                    log.debug(response);
                    deferred.reject(response);
                });
            return deferred.promise;
        };

        var _take = function(theEntity, toUser) {
            var deferred = $q.defer();

            $http.post(appConfig.API_URL + mainEntity.entityName + '/take?entity_id=' + theEntity.id + '&user_id=' + toUser.id)
                .then(function(response) {
                    if (typeof response.data === 'object') {
                        var backendResponse = response.data;
                        if (backendResponse.ErrorThrown) {
                            alertify.alert(backendResponse.ResponseDescription).set('modal', true);
                            log.debug(response);
                            deferred.reject(response);
                        } else {
                            theEntity.User_AssignedTo = toUser.id;
                            var originalEntity = _getById(theEntity.id);
                            if (originalEntity) {
                                originalEntity.User_AssignedTo = toUser.id;
                            }
                            $timeout(function() {
                                alertify.success(backendResponse.ResponseDescription);
                            });
                            deferred.resolve(backendResponse.Result);
                        }
                    } else {
                        // invalid response
                        alertify.alert('An error has occurred, see console for more details.').set('modal', true);
                        log.debug(response);
                        deferred.reject(response);
                    }
                }, function(response) {
                    // something went wrong
                    alertify.alert('An error has occurred, see console for more details.').set('modal', true);
                    log.debug(response);
                    deferred.reject(response);
                });
            return deferred.promise;

            //From original SIF Service:
            //
            // var theEntitySelected = this.getById(theEntity.id);
            // theEntity.AssignedToKey = toUser.id;
            // theEntity.assignedTo = toUser.userName;

            // try {
            //     angular.copy(theEntity, theEntitySelected);
            // } catch (e) {
            //     console.debug(e);
            // }

            // var dDueDate;
            // dDueDate = new Date();
            // masterListService.create('SIF', theEntity.assignedTo, theEntity.assignedTo, 'Complete SIF', theEntity.Priority, dDueDate, theEntity.TaskKey);

            // alertify.success(entityName + ' taken successfully!');
            // return true;
        };

        var _getRawAll = function() {
            return _arrAllRecords;
        }

        // Public crudFactory API:////////////////////////////////////////////////////////////
        var oAPI = {

            //Entity:
            entityName: mainEntity.entityName, //Entity name which should be the same as Webservice/Endpoint/API to call in requests.
            create: mainEntity.create, //Creates locally a new instance of Entity, it also populates default values.
            validate: mainEntity.validate, //Validates Entity fields.
            getProgress: mainEntity.getProgress, //Gets Entity progress based on required fields.

            //Cached:
            getById: _getById, //Gets single Entity by ID from local array.
            getByParentId: _getByParentId, //Gets array of Entities by ParentID from local array. (ParentID is defined by programmer on configuration).
            getSingleByParentId: _getSingleByParentId, //Gets single Entity by ParentID from local array.
            getRecursiveBySeedId: _getRecursiveBySeedId, //Function for recursive lists, gets a single entity with all recursive children by SeedID
            getAll: _getAll, //Returns all Entities from local array.
            getRawAll: _getRawAll, //TODO find a better solution.
            catalogs: _catalogs, //Stores catalogs defined on configuration.

            //Server transactions:
            loadDependencies: _loadDependencies, //Pull dependencies defined on configuration.
            loadCatalogs: _loadCatalogs, //Pull defined catalogs and stores them on this.catalogs property.
            loadEntities: _loadEntities, //Pull all Entities and stores them on local array.
            loadEntity: _loadEntity, //Pull a single entity given an ID or ParentKey.
            loadAll: _loadAll, //Calls loadDependencies, loadCatalogs, loadEntities.
            readByParentId: _readByParentId, //Pull an array of Entities given a ParentKey and store them on local array.
            readSingleByParentId: _readSingleByParentId, //Pull a single Entity given a ParentKey.
            addBatch: _addBatch, //Save a batch of Entities.
            save: _save, //Creates or updates a single Entity.
            remove: _remove, //Removes a single Entity.
            removeSelected: _removeSelected, //Removes a batch of Entities. (to be depricated)
            removeBatch: _removeBatch, //Removes a batch of Entities.
            customPost: _customPost, //Request a custom name method via Post.
            customGet: _customGet, //Request a custom name method via Post.            
            take: _take //Set a user responsible for an Entity.

        };
        _arrDependenciesAndThis.push(oAPI);
        var _self = oAPI;
        return oAPI;
    };
});
