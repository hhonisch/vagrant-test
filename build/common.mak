### Common Makefile settings

# Enable secondary expansion
.SECONDEXPANSION:

# Helpers
EMPTY :=
SPACE := $(EMPTY) $(EMPTY)

# src dir
SRC_DIR := $(ROOT_DIR)/src

# test dir
TEST_DIR := $(ROOT_DIR)/test

# log dir
LOG_DIR := $(ROOT_DIR)/log

# install media dir
INSTALL_MEDIA_DIR := $(ROOT_DIR)/install-media

# dist dir
DIST_DIR := $(ROOT_DIR)/dist

# Base dir where VM is created
VM_BASE_DIR := $(abspath $(ROOT_DIR)/vm-base)

# Root dir for Vagrant test environments
VG_TEST_ROOT_DIR := $(ROOT_DIR)/vagrant-test-env

# Check whether VirtualBox is installed
ifndef MAKE_VIRTUALBOX
ifneq ($(shell which vboxmanage),)
export MAKE_VIRTUALBOX=1
$(info *** VirtualBox detected ***)
else
export MAKE_VIRTUALBOX=
endif
endif

# Check whether VMware is installed
ifndef MAKE_VMWARE
ifneq ($(shell which vmrun),)
export MAKE_VMWARE=1
$(info *** VMware detected ***)
else
export MAKE_VMWARE=
endif
endif

# Include config settings
include $(ROOT_DIR)/build/config.mak

